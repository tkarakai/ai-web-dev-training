'use client';

import { useState, useMemo } from 'react';

interface TrainingExample {
  prompt: string;
  completion: string;
}

interface DatasetStats {
  totalExamples: number;
  avgPromptLength: number;
  avgCompletionLength: number;
}

const SAMPLE_DATASETS: Record<string, TrainingExample[]> = {
  'Customer Support': [
    {
      prompt: 'How do I reset my password?',
      completion: 'To reset your password, click the "Forgot Password" link on the login page. Enter your email address, and we\'ll send you a reset link.',
    },
    {
      prompt: "I can't log into my account",
      completion: 'Please try clearing your browser cache and ensure Caps Lock is off. If issues persist, use the "Forgot Password" option.',
    },
    {
      prompt: 'How do I cancel my subscription?',
      completion: 'You can cancel anytime from Account Settings > Subscription > Cancel Plan. Your access continues until the billing period ends.',
    },
  ],
  'Code Explanation': [
    {
      prompt: 'Explain: const doubled = arr.map(x => x * 2)',
      completion: 'This uses map() to create a new array where each element is doubled. The arrow function takes each element x and returns x * 2.',
    },
    {
      prompt: 'Explain: const unique = [...new Set(arr)]',
      completion: 'This creates an array of unique values. Set removes duplicates, and the spread operator converts it back to an array.',
    },
  ],
  'Style Transfer': [
    {
      prompt: 'Make casual: We regret to inform you that your request has been denied.',
      completion: "Sorry, but we can't approve your request this time.",
    },
    {
      prompt: 'Make casual: Please be advised that the meeting has been rescheduled.',
      completion: "Heads up - we've moved the meeting to a later date.",
    },
  ],
};

function formatExample(example: TrainingExample): string {
  return `<|im_start|>user\n${example.prompt}<|im_end|>\n<|im_start|>assistant\n${example.completion}<|im_end|>`;
}

function toJSONL(examples: TrainingExample[]): string {
  return examples.map((ex) => JSON.stringify({ text: formatExample(ex) })).join('\n');
}

function calculateStats(examples: TrainingExample[]): DatasetStats {
  if (examples.length === 0) {
    return { totalExamples: 0, avgPromptLength: 0, avgCompletionLength: 0 };
  }
  return {
    totalExamples: examples.length,
    avgPromptLength: Math.round(examples.reduce((s, e) => s + e.prompt.length, 0) / examples.length),
    avgCompletionLength: Math.round(examples.reduce((s, e) => s + e.completion.length, 0) / examples.length),
  };
}

function generateTrainingCommand(config: {
  model: string;
  iters: number;
  batchSize: number;
  loraRank: number;
}): string {
  return `uvx --from mlx-lm mlx_lm.lora \\
  --model ${config.model} \\
  --train \\
  --data ./training-data \\
  --iters ${config.iters} \\
  --batch-size ${config.batchSize} \\
  --lora-rank ${config.loraRank} \\
  --adapter-path ./adapters`;
}

export default function FineTuningPage() {
  const [selectedDataset, setSelectedDataset] = useState<string>('Customer Support');
  const [customExamples, setCustomExamples] = useState<TrainingExample[]>([]);
  const [newPrompt, setNewPrompt] = useState('');
  const [newCompletion, setNewCompletion] = useState('');
  const [activeTab, setActiveTab] = useState<'data' | 'config' | 'commands'>('data');

  const [config, setConfig] = useState({
    model: 'Qwen/Qwen3-0.6B',
    iters: 1000,
    batchSize: 4,
    loraRank: 8,
  });

  const examples = customExamples.length > 0 ? customExamples : SAMPLE_DATASETS[selectedDataset] || [];
  const stats = useMemo(() => calculateStats(examples), [examples]);
  const jsonlOutput = useMemo(() => toJSONL(examples), [examples]);
  const trainingCommand = useMemo(() => generateTrainingCommand(config), [config]);

  const addExample = () => {
    if (newPrompt.trim() && newCompletion.trim()) {
      setCustomExamples([...customExamples, { prompt: newPrompt.trim(), completion: newCompletion.trim() }]);
      setNewPrompt('');
      setNewCompletion('');
    }
  };

  const removeExample = (index: number) => {
    setCustomExamples(customExamples.filter((_, i) => i !== index));
  };

  const useSampleDataset = (name: string) => {
    setSelectedDataset(name);
    setCustomExamples([]);
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Exercise 18: Fine-Tuning with MLX</h1>
        <p className="text-gray-400 mb-8">
          Prepare training data and fine-tune models on Mac using MLX
        </p>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['data', 'config', 'commands'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg capitalize ${
                activeTab === tab ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'
              }`}
            >
              {tab === 'data' ? 'Training Data' : tab === 'config' ? 'Configuration' : 'Commands'}
            </button>
          ))}
        </div>

        {/* Data Tab */}
        {activeTab === 'data' && (
          <div className="space-y-6">
            {/* Sample Datasets */}
            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Sample Datasets</h2>
              <div className="flex gap-2 flex-wrap">
                {Object.keys(SAMPLE_DATASETS).map((name) => (
                  <button
                    key={name}
                    onClick={() => useSampleDataset(name)}
                    className={`px-3 py-1 rounded ${
                      selectedDataset === name && customExamples.length === 0
                        ? 'bg-blue-600'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* Add Custom Example */}
            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Add Training Example</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Prompt (Input)</label>
                  <textarea
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    placeholder="The input prompt..."
                    className="w-full h-24 bg-gray-800 border border-gray-700 rounded p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Completion (Expected Output)</label>
                  <textarea
                    value={newCompletion}
                    onChange={(e) => setNewCompletion(e.target.value)}
                    placeholder="The expected response..."
                    className="w-full h-24 bg-gray-800 border border-gray-700 rounded p-2 text-sm"
                  />
                </div>
              </div>
              <button
                onClick={addExample}
                disabled={!newPrompt.trim() || !newCompletion.trim()}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 px-4 py-2 rounded"
              >
                Add Example
              </button>
            </div>

            {/* Current Dataset */}
            <div className="bg-gray-900 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">
                  Current Dataset ({stats.totalExamples} examples)
                </h2>
                <div className="text-sm text-gray-400">
                  Avg prompt: {stats.avgPromptLength} chars | Avg completion: {stats.avgCompletionLength} chars
                </div>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {examples.map((ex, i) => (
                  <div key={i} className="bg-gray-800 rounded p-3">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-400">Example {i + 1}</span>
                      {customExamples.length > 0 && (
                        <button
                          onClick={() => removeExample(i)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-sm mb-1">
                      <span className="text-blue-400">Prompt:</span> {ex.prompt}
                    </p>
                    <p className="text-sm">
                      <span className="text-green-400">Completion:</span> {ex.completion}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* JSONL Output */}
            <div className="bg-gray-900 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">JSONL Output</h2>
                <button
                  onClick={() => navigator.clipboard.writeText(jsonlOutput)}
                  className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
                >
                  Copy
                </button>
              </div>
              <pre className="bg-gray-800 p-4 rounded text-xs overflow-x-auto max-h-64 font-mono">
                {jsonlOutput}
              </pre>
            </div>
          </div>
        )}

        {/* Config Tab */}
        {activeTab === 'config' && (
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-6">Training Configuration</h2>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Base Model</label>
                <select
                  value={config.model}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
                >
                  <option value="Qwen/Qwen3-0.6B">Qwen3-0.6B (Small, Fast)</option>
                  <option value="Qwen/Qwen3-1.7B">Qwen3-1.7B (Medium)</option>
                  <option value="Qwen/Qwen3-4B">Qwen3-4B (Larger)</option>
                  <option value="microsoft/phi-2">Phi-2 (2.7B)</option>
                  <option value="TinyLlama/TinyLlama-1.1B-Chat-v1.0">TinyLlama-1.1B</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Smaller models train faster</p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Training Iterations</label>
                <input
                  type="number"
                  value={config.iters}
                  onChange={(e) => setConfig({ ...config, iters: parseInt(e.target.value) || 1000 })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">More iterations = longer training</p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Batch Size</label>
                <input
                  type="number"
                  value={config.batchSize}
                  onChange={(e) => setConfig({ ...config, batchSize: parseInt(e.target.value) || 4 })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">Higher = faster but more memory</p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">LoRA Rank</label>
                <input
                  type="number"
                  value={config.loraRank}
                  onChange={(e) => setConfig({ ...config, loraRank: parseInt(e.target.value) || 8 })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">Higher = more expressive but slower</p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gray-800 rounded">
              <h3 className="font-medium mb-2">About LoRA</h3>
              <p className="text-sm text-gray-400">
                LoRA (Low-Rank Adaptation) trains a small set of adapter weights instead of the full model.
                This makes training faster, uses less memory, and produces small adapter files (~50MB vs 15GB+).
                The adapter is loaded alongside the base model at inference time.
              </p>
            </div>
          </div>
        )}

        {/* Commands Tab */}
        {activeTab === 'commands' && (
          <div className="space-y-6">
            {/* Prerequisites */}
            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Prerequisites</h2>
              <div className="space-y-3">
                <div className="bg-gray-800 rounded p-3">
                  <p className="text-sm text-gray-400 mb-1">1. Mac with Apple Silicon (M1/M2/M3)</p>
                </div>
                <div className="bg-gray-800 rounded p-3">
                  <p className="text-sm text-gray-400 mb-1">2. Install uv (Python package manager)</p>
                  <code className="text-sm font-mono text-green-400">curl -LsSf https://astral.sh/uv/install.sh | sh</code>
                </div>
                <div className="bg-gray-800 rounded p-3">
                  <p className="text-sm text-gray-400 mb-1">3. Create training data directory</p>
                  <code className="text-sm font-mono text-green-400">mkdir -p training-data</code>
                </div>
              </div>
            </div>

            {/* Step 1: Save Data */}
            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Step 1: Save Training Data</h2>
              <p className="text-gray-400 mb-4">
                Save your JSONL data to <code className="text-blue-400">training-data/train.jsonl</code>
              </p>
              <pre className="bg-gray-800 p-4 rounded text-sm overflow-x-auto font-mono">
{`# Copy the JSONL output from the Data tab and save:
cat > training-data/train.jsonl << 'EOF'
${jsonlOutput.split('\n').slice(0, 3).join('\n')}
...
EOF`}
              </pre>
            </div>

            {/* Step 2: Train */}
            <div className="bg-gray-900 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Step 2: Run Training</h2>
                <button
                  onClick={() => navigator.clipboard.writeText(trainingCommand)}
                  className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
                >
                  Copy
                </button>
              </div>
              <pre className="bg-gray-800 p-4 rounded text-sm overflow-x-auto font-mono text-green-400">
                {trainingCommand}
              </pre>
              <p className="text-gray-400 text-sm mt-4">
                This will download the model (first run only) and train LoRA adapters.
                Training ~1000 iterations takes about 5-15 minutes on M1/M2.
              </p>
            </div>

            {/* Step 3: Test */}
            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Step 3: Test the Model</h2>
              <pre className="bg-gray-800 p-4 rounded text-sm overflow-x-auto font-mono text-green-400">
{`uvx --from mlx-lm mlx_lm.generate \\
  --model ${config.model} \\
  --adapter-path ./adapters \\
  --prompt "How do I reset my password?" \\
  --max-tokens 200`}
              </pre>
            </div>

            {/* Step 4: Fuse (Optional) */}
            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Step 4: Fuse Adapter (Optional)</h2>
              <p className="text-gray-400 mb-4">
                Merge the adapter into the base model for easier deployment:
              </p>
              <pre className="bg-gray-800 p-4 rounded text-sm overflow-x-auto font-mono text-green-400">
{`uvx --from mlx-lm mlx_lm.fuse \\
  --model ${config.model} \\
  --adapter-path ./adapters \\
  --save-path ./fused-model`}
              </pre>
            </div>
          </div>
        )}

        {/* Code Reference */}
        <div className="mt-8 bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Code Patterns</h2>
          <pre className="bg-gray-800 p-4 rounded text-sm overflow-x-auto">
{`// lib/fine-tuning.ts - Key functions

// Format for MLX training
function formatTrainingExample(example: TrainingExample): string {
  const formatted = \`<|im_start|>user\\n\${example.prompt}<|im_end|>
<|im_start|>assistant\\n\${example.completion}<|im_end|>\`;
  return JSON.stringify({ text: formatted });
}

// Convert to JSONL
const jsonl = examples.map(formatTrainingExample).join('\\n');

// Split into train/validation
const { train, valid } = splitDataset(examples, 0.9, true, 42);

// Generate training command
const cmd = generateTrainingCommand({
  model: 'Qwen/Qwen3-0.6B',
  iters: 1000,
  batchSize: 4,
  loraRank: 8,
});`}
          </pre>
        </div>
      </div>
    </div>
  );
}
