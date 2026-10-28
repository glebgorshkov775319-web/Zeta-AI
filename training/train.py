"""
Zeta AI QLoRA fine-tuning script.
Designed for a Kaggle GPU notebook. It trains a LoRA adapter, not a new model from scratch.
"""
import os
from pathlib import Path

import torch
from datasets import load_dataset
from peft import LoraConfig, prepare_model_for_kbit_training, get_peft_model
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
)
from trl import SFTTrainer

BASE_MODEL = os.environ.get("BASE_MODEL", "Qwen/Qwen3-4B")
DATA_FILE = os.environ.get("DATA_FILE", "training/dataset.jsonl")
OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "zeta-adapter")
MAX_SEQ_LENGTH = int(os.environ.get("MAX_SEQ_LENGTH", "1024"))

def main():
    if not torch.cuda.is_available():
        raise RuntimeError(
            "No GPU detected. In Kaggle, open Notebook settings and select an available GPU accelerator."
        )

    data_path = Path(DATA_FILE)
    if not data_path.exists():
        raise FileNotFoundError(
            f"Dataset not found: {data_path}. Run this script from the repository root "
            "or set DATA_FILE to the correct path."
        )

    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    dataset = load_dataset("json", data_files=str(data_path), split="train")
    if "messages" not in dataset.column_names:
        raise ValueError('Each JSONL row must contain a "messages" array.')

    def to_text(row):
        text = tokenizer.apply_chat_template(
            row["messages"],
            tokenize=False,
            add_generation_prompt=False,
            enable_thinking=False,
        )
        return {"text": text}

    dataset = dataset.map(to_text, remove_columns=dataset.column_names)
    if len(dataset) < 2:
        raise ValueError("Add at least two training examples before starting.")

    compute_dtype = torch.float16
    quant_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=compute_dtype,
    )

    model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        quantization_config=quant_config,
        device_map="auto",
        trust_remote_code=True,
        torch_dtype=compute_dtype,
    )
    model.config.use_cache = False
    model = prepare_model_for_kbit_training(model)

    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        num_train_epochs=3,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=8,
        learning_rate=2e-4,
        logging_steps=1,
        save_strategy="epoch",
        save_total_limit=2,
        fp16=True,
        bf16=False,
        gradient_checkpointing=True,
        optim="paged_adamw_8bit",
        report_to="none",
        remove_unused_columns=False,
        seed=42,
    )

    trainer = SFTTrainer(
        model=model,
        args=args,
        train_dataset=dataset,
        processing_class=tokenizer,
        dataset_text_field="text",
        max_seq_length=MAX_SEQ_LENGTH,
        packing=False,
    )

    trainer.train()
    trainer.model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    print(f"Training finished. LoRA adapter and tokenizer saved to: {OUTPUT_DIR}")
    print("This is an adapter, not a full standalone base model. Keep the base model license and weights in mind.")

if __name__ == "__main__":
    main()
