# Exercise 18: Fine-Tuning with MLX

Train custom models on Mac using MLX and LoRA.

## What You'll Learn

1. **Training Data Format** - JSONL with chat template formatting
2. **Data Preparation** - Validation, statistics, train/val split
3. **LoRA Training** - Parameter-efficient fine-tuning with MLX
4. **Evaluation** - Compare before/after performance

## Prerequisites

**Mac with Apple Silicon (M1/M2/M3/M4)** is required.

```bash
# Install uv (Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Create training data directory
mkdir -p training-data
```

## The Code to Study

```
lib/fine-tuning.ts       <- THE MAIN FILE - data formatting, commands
lib/fine-tuning.test.ts  <- Unit tests
```

## Quick Start

### 1. Prepare Training Data

```typescript
import { toJSONL, splitDataset } from './lib/fine-tuning';

const examples = [
  { prompt: 'How do I reset my password?', completion: 'Click "Forgot Password"...' },
  { prompt: 'Cancel subscription?', completion: 'Go to Account Settings...' },
];

// Format as JSONL
const jsonl = toJSONL(examples);

// Split into train/val (90/10)
const { train, valid } = splitDataset(examples, 0.9);
```

### 2. Save Training Files

```bash
# Save your data
echo "$JSONL_DATA" > training-data/train.jsonl
```

### 3. Run Training

```bash
uvx --from mlx-lm mlx_lm.lora \
  --model Qwen/Qwen3-0.6B \
  --train \
  --data ./training-data \
  --iters 1000 \
  --batch-size 4 \
  --lora-rank 8 \
  --adapter-path ./adapters
```

### 4. Test the Model

```bash
uvx --from mlx-lm mlx_lm.generate \
  --model Qwen/Qwen3-0.6B \
  --adapter-path ./adapters \
  --prompt "How do I reset my password?" \
  --max-tokens 200
```

## Run the Exercise

```bash
# Install dependencies
bun install

# Run tests
bun test

# Start the UI
bun dev
```

Open http://localhost:3018 to prepare training data interactively.

## Key Concepts

### JSONL Format

MLX expects JSONL with a `text` field containing the formatted conversation:

```jsonl
{"text": "<|im_start|>user\nHow do I reset my password?<|im_end|>\n<|im_start|>assistant\nClick 'Forgot Password'...<|im_end|>"}
{"text": "<|im_start|>user\nCancel subscription?<|im_end|>\n<|im_start|>assistant\nGo to Account Settings...<|im_end|>"}
```

### Chat Template

Most models expect a specific format:

```
<|im_start|>user
{user message}
<|im_end|>
<|im_start|>assistant
{assistant response}
<|im_end|>
```

### LoRA (Low-Rank Adaptation)

Instead of training all model weights:
- Trains small "adapter" matrices (~50MB vs 15GB)
- Much faster training (minutes vs hours)
- Lower memory requirements
- Adapter loaded alongside base model

```
Base Model (frozen)     LoRA Adapter (trained)
     15GB         +           50MB
       ↓                        ↓
           Combined at runtime
```

## Training Parameters

| Parameter | Description | Recommended |
|-----------|-------------|-------------|
| `--iters` | Training iterations | 500-2000 |
| `--batch-size` | Examples per step | 2-8 |
| `--learning-rate` | Step size | 1e-5 to 1e-4 |
| `--lora-rank` | Adapter expressiveness | 4-16 |
| `--lora-layers` | Layers to adapt | 8-32 |

## Code Patterns

### Format Training Example

```typescript
function formatTrainingExample(example: TrainingExample): string {
  const formatted = `<|im_start|>user
${example.prompt}<|im_end|>
<|im_start|>assistant
${example.completion}<|im_end|>`;

  return JSON.stringify({ text: formatted });
}
```

### Validate Dataset

```typescript
function validateExample(example: TrainingExample): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!example.prompt?.trim()) errors.push('Empty prompt');
  if (!example.completion?.trim()) errors.push('Empty completion');
  if (example.prompt.length > 4096) errors.push('Prompt too long');

  return { valid: errors.length === 0, errors };
}
```

### Calculate Statistics

```typescript
function calculateStats(examples: TrainingExample[]): DatasetStats {
  return {
    totalExamples: examples.length,
    avgPromptLength: examples.reduce((s, e) => s + e.prompt.length, 0) / examples.length,
    avgCompletionLength: examples.reduce((s, e) => s + e.completion.length, 0) / examples.length,
  };
}
```

### Train/Val Split

```typescript
const { train, valid } = splitDataset(examples, 0.9, true, 42);
// 90% train, 10% validation, shuffled with seed 42
```

## Recommended Models

| Model | Size | Memory | Training Time |
|-------|------|--------|---------------|
| Qwen3-0.6B | 0.6B | ~2GB | ~5 min |
| TinyLlama-1.1B | 1.1B | ~3GB | ~10 min |
| Qwen3-1.7B | 1.7B | ~4GB | ~15 min |
| Phi-2 | 2.7B | ~6GB | ~20 min |

## Exercises to Try

1. **Custom dataset** - Prepare data for your own use case
2. **Hyperparameter tuning** - Experiment with learning rate, rank
3. **Evaluation** - Compare model before/after fine-tuning
4. **Multi-turn conversations** - Format and train on dialogues
5. **Style transfer** - Train model to write in specific style

## Common Issues

### Out of Memory
- Reduce `--batch-size` to 1 or 2
- Use a smaller model
- Close other applications

### Poor Results
- Need more training data (50+ examples recommended)
- Increase `--iters`
- Check data format is correct

### Model Not Found
- First run downloads the model (~1-15GB)
- Ensure internet connection
- Check Hugging Face model name is correct

## File Structure

```
fine-tuning-project/
├── training-data/
│   ├── train.jsonl      # Training examples
│   └── valid.jsonl      # Validation examples
├── adapters/            # LoRA weights (created by training)
└── fused-model/         # Merged model (optional)
```

## Next Exercise

[Exercise 19: Voice Interfaces](../19-voice) - Build speech-to-text and text-to-speech interfaces.
