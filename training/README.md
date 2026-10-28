# Zeta AI — model fine-tuning

This folder contains a starter QLoRA fine-tuning workflow for a Kaggle GPU notebook.

## Important

- This does **not** train a foundation model from scratch.
- It fine-tunes the open-weight base model `Qwen/Qwen3-4B` and saves a LoRA adapter.
- The small `dataset.jsonl` file is only a starter example set. It is not enough to create a high-quality assistant. Expand and carefully review the dataset before expecting meaningful improvements.
- The base model's license and terms still apply. Review https://huggingface.co/Qwen/Qwen3-4B before using or redistributing it.
- Training needs an available GPU. Free cloud GPU access is limited and may not be available at every moment.
- No OpenAI, OpenRouter, or other inference API key is used by this training script.

## Run in Kaggle

1. Open https://www.kaggle.com/code and create a new notebook.
2. In notebook settings, select an available GPU accelerator.
3. Upload this repository's `training/` folder to the notebook, or clone the repository in a notebook cell:
   ```bash
   !git clone https://github.com/glebgorshkov775319-web/Zeta-AI.git
   %cd Zeta-AI
   ```
4. Install the pinned packages:
   ```bash
   !pip install -r training/requirements.txt
   ```
5. Start training:
   ```bash
   !python training/train.py
   ```
6. The adapter will be written to `zeta-adapter/`. Download the folder from Kaggle's output/files panel before the temporary session ends.

## Dataset format

Each line of `dataset.jsonl` must be one JSON object containing a `messages` array with `system`, `user`, and `assistant` messages. Use high-quality examples that you have permission to use. Do not put passwords, private conversations, or personal data in the dataset.

## What comes next

After training, evaluate the adapter on a separate test set. The current Vercel chat endpoint still uses OpenRouter; this training folder does not change the live website or deploy a model server. To remove the external AI API, a separate inference server must load the base model plus the trained adapter, and the website backend must be updated to call that server. Do not commit large model weights or secrets to this repository.
