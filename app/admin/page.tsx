'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { getToken } from 'next-auth/jwt';

export default function AdminPanel() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<'transcription' | 'llm'>('transcription');
  
  // Transcription state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcriptionProvider, setTranscriptionProvider] = useState('whisper-api');
  const [transcriptionResult, setTranscriptionResult] = useState<any>(null);
  const [transcriptionLoading, setTranscriptionLoading] = useState(false);
  
  // LLM state
  const [llmInput, setLlmInput] = useState('');
  const [llmProvider, setLlmProvider] = useState('gpt-4o-mini');
  const [llmResult, setLlmResult] = useState<any>(null);
  const [llmLoading, setLlmLoading] = useState(false);

  // Auth check
  if (status === 'loading') return <div className="p-8">Loading...</div>;
  if (!session) return <div className="p-8">Please log in to access the admin panel.</div>;

  // Get JWT token for API calls
  const getAuthToken = async () => {
    const response = await fetch('/api/admin/token');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to get token');
    }
    
    return data.token;
  };

  const testTranscription = async () => {
    if (!audioFile) return;
    
    setTranscriptionLoading(true);
    try {
      const token = await getAuthToken();
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('provider', transcriptionProvider);
      formData.append('language', 'en');

      const response = await fetch('http://localhost:4000/v1/transcribe/transcribe', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();
      setTranscriptionResult(result);
    } catch (error) {
      console.error('Transcription error:', error);
      setTranscriptionResult({ error: error.message });
    } finally {
      setTranscriptionLoading(false);
    }
  };

  const testLLM = async () => {
    if (!llmInput.trim()) return;
    
    setLlmLoading(true);
    try {
      const token = await getAuthToken();
      
      const response = await fetch('http://localhost:4000/v1/llm/complete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider: llmProvider,
          messages: [
            { role: 'user', content: llmInput }
          ],
          max_tokens: 200,
          temperature: 0.7
        })
      });

      const result = await response.json();
      setLlmResult(result);
    } catch (error) {
      console.error('LLM error:', error);
      setLlmResult({ error: error.message });
    } finally {
      setLlmLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Whisnap Admin Panel
        </h1>
        
        <p className="text-gray-600 mb-8">
          Test AI providers directly through the Express API backend.
          <br />
          Logged in as: {session.user?.email}
        </p>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-200 rounded-lg p-1 mb-8">
          <button
            onClick={() => setActiveTab('transcription')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'transcription'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Audio Transcription
          </button>
          <button
            onClick={() => setActiveTab('llm')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'llm'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            LLM Testing
          </button>
        </div>

        {/* Transcription Tab */}
        {activeTab === 'transcription' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-6">Test Audio Transcription</h2>
            
            {/* Provider Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Provider
              </label>
              <select
                value={transcriptionProvider}
                onChange={(e) => setTranscriptionProvider(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="whisper-api">OpenAI Whisper</option>
                <option value="assemblyai-streaming">AssemblyAI</option>
                <option value="deepgram-nova3">Deepgram Nova</option>
                <option value="rev-turbo">Rev.ai Turbo</option>
              </select>
            </div>

            {/* File Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Audio File
              </label>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
            </div>

            {/* Test Button */}
            <button
              onClick={testTranscription}
              disabled={!audioFile || transcriptionLoading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {transcriptionLoading ? 'Transcribing...' : 'Test Transcription'}
            </button>

            {/* Results */}
            {transcriptionResult && (
              <div className="mt-6 p-4 bg-gray-50 rounded-md">
                <h3 className="font-medium mb-2">Result:</h3>
                <pre className="text-sm text-gray-600 whitespace-pre-wrap">
                  {JSON.stringify(transcriptionResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* LLM Tab */}
        {activeTab === 'llm' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-6">Test LLM Completion</h2>
            
            {/* Provider Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Model
              </label>
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="gpt-4o">GPT-4o</option>
                <option value="claude-3-haiku">Claude 3 Haiku</option>
                <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
              </select>
            </div>

            {/* Input Text */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prompt
              </label>
              <textarea
                value={llmInput}
                onChange={(e) => setLlmInput(e.target.value)}
                placeholder="Enter your prompt here..."
                className="w-full p-3 border border-gray-300 rounded-md h-32 resize-none"
              />
            </div>

            {/* Test Button */}
            <button
              onClick={testLLM}
              disabled={!llmInput.trim() || llmLoading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {llmLoading ? 'Processing...' : 'Test LLM'}
            </button>

            {/* Results */}
            {llmResult && (
              <div className="mt-6 p-4 bg-gray-50 rounded-md">
                <h3 className="font-medium mb-2">Result:</h3>
                <pre className="text-sm text-gray-600 whitespace-pre-wrap">
                  {JSON.stringify(llmResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* System Info */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">System Status</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Next.js Frontend:</span>
              <span className="text-green-600 ml-2">✓ Online (Port 3000)</span>
            </div>
            <div>
              <span className="font-medium">Express API:</span>
              <span className="text-green-600 ml-2">✓ Online (Port 4000)</span>
            </div>
            <div>
              <span className="font-medium">Database:</span>
              <span className="text-green-600 ml-2">✓ Connected</span>
            </div>
            <div>
              <span className="font-medium">JWT Auth:</span>
              <span className="text-green-600 ml-2">✓ Configured</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}