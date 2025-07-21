import { OpenAITranscriptionProvider } from '../../src/providers/transcription/openai';
import { OpenAIProvider } from '../../src/providers/llm/openai';
import fs from 'fs';
import path from 'path';

// Skip tests if no API key
const skipIfNoKey = () => {
  if (!process.env.OPENAI_API_KEY) {
    console.log('🚫 Skipping user audio tests - no API key');
    return true;
  }
  return false;
};

describe('User Audio Test - Real API', () => {
  let transcriptionProvider: OpenAITranscriptionProvider;
  let llmProvider: OpenAIProvider;

  beforeAll(() => {
    if (skipIfNoKey()) return;
    
    transcriptionProvider = new OpenAITranscriptionProvider();
    llmProvider = new OpenAIProvider();
  });

  it('should transcribe user audio and process with LLM', async () => {
    if (skipIfNoKey()) return;

    // Load user's audio file
    const audioPath = '/Users/ned/Desktop/Projects/whisnap-web/test_audio/00620.wav';
    
    if (!fs.existsSync(audioPath)) {
      console.log('🚫 Audio file not found:', audioPath);
      return;
    }

    const testAudio = fs.readFileSync(audioPath);

    console.log('🎵 Testing user audio with OpenAI Whisper...');
    console.log(`Audio file: ${audioPath}`);
    console.log(`Audio size: ${testAudio.length} bytes`);

    // Step 1: Transcribe the audio
    const transcriptionResult = await transcriptionProvider.transcribe({
      audio: testAudio,
      userId: 'test-user',
      language: 'en'
    });

    console.log('✅ Transcription result:', transcriptionResult);
    console.log(`📝 Transcribed text: "${transcriptionResult.text}"`);
    console.log(`💰 Transcription cost: $${transcriptionResult.cost}`);
    console.log(`⏱️ Duration: ${transcriptionResult.duration}s`);

    expect(transcriptionResult.text).toBeDefined();
    expect(transcriptionResult.provider).toBe('whisper-api');

    // Step 2: Process transcription with LLM
    console.log('\n🤖 Processing transcription with GPT-4o-mini...');
    
    const llmResult = await llmProvider.complete({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful assistant. Analyze the following transcribed audio and provide a summary of what was said, the main topics discussed, and any key insights. Be concise but thorough.' 
        },
        { 
          role: 'user', 
          content: `Please analyze this transcribed audio: "${transcriptionResult.text}"` 
        }
      ],
      max_tokens: 200,
      temperature: 0.3,
      userId: 'test-user'
    });

    console.log('✅ LLM analysis result:', llmResult);
    console.log(`🎯 LLM Response: "${llmResult.choices[0]?.message.content}"`);
    console.log(`📊 Token usage: ${llmResult.usage?.prompt_tokens} → ${llmResult.usage?.completion_tokens} (${llmResult.usage?.total_tokens} total)`);

    // Calculate real cost
    const llmCost = llmProvider.calculateCost('gpt-4o-mini', llmResult.usage?.prompt_tokens || 0, llmResult.usage?.completion_tokens || 0);
    console.log(`💰 LLM cost: $${llmCost.toFixed(6)}`);

    expect(llmResult.choices).toHaveLength(1);
    expect(llmResult.choices[0]?.message.content).toBeDefined();
    expect(llmResult.usage).toBeDefined();

    // Log combined results
    console.log('\n📋 COMPLETE WORKFLOW RESULTS:');
    console.log('='.repeat(50));
    console.log(`🎵 Original audio: ${path.basename(audioPath)}`);
    console.log(`📝 Transcription: "${transcriptionResult.text}"`);
    console.log(`🤖 LLM Analysis: "${llmResult.choices[0]?.message.content}"`);
    console.log(`💰 Total cost: $${(parseFloat(transcriptionResult.cost) + llmCost).toFixed(6)}`);

  }, 60000); // 60 second timeout for API calls
});