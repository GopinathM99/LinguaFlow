import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { AUDIO_INPUT_SAMPLE_RATE, AUDIO_OUTPUT_SAMPLE_RATE, GEMINI_MODEL } from '../constants';
import { ConnectionState, ChatMessage } from '../types';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audio';

interface UseLiveTranslatorProps {
  apiKey: string;
  targetLanguage: string;
}

export function useLiveTranslator({ apiKey, targetLanguage }: UseLiveTranslatorProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [detectedLanguage, setDetectedLanguage] = useState<string>('Waiting for speech...');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  // Audio Refs
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Session & Playback
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Transcription buffer
  const currentInputTransRef = useRef<string>('');
  const currentOutputTransRef = useRef<string>('');

  const disconnect = useCallback(async () => {
    setConnectionState(ConnectionState.DISCONNECTED);
    
    if (sessionPromiseRef.current) {
      try {
        const session = await sessionPromiseRef.current;
        session.close();
      } catch (e) {
        console.error('Error closing session', e);
      }
      sessionPromiseRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
    }

    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }
    
    // Stop all scheduled audio
    scheduledSourcesRef.current.forEach(s => s.stop());
    scheduledSourcesRef.current.clear();
    
    if (outputContextRef.current) {
      outputContextRef.current.close();
      outputContextRef.current = null;
    }

    setDetectedLanguage('Waiting for speech...');
  }, []);

  const connect = useCallback(async () => {
    if (!apiKey) {
        alert('Please provide a valid API Key.');
        return;
    }

    setConnectionState(ConnectionState.CONNECTING);

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      // Setup Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      inputContextRef.current = new AudioContextClass({
        sampleRate: AUDIO_INPUT_SAMPLE_RATE,
      });
      outputContextRef.current = new AudioContextClass({
        sampleRate: AUDIO_OUTPUT_SAMPLE_RATE,
      });

      // Visualizers
      inputAnalyserRef.current = inputContextRef.current.createAnalyser();
      outputAnalyserRef.current = outputContextRef.current.createAnalyser();
      inputAnalyserRef.current.fftSize = 256;
      outputAnalyserRef.current.fftSize = 256;

      // Microphone
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      sourceRef.current = inputContextRef.current.createMediaStreamSource(streamRef.current);
      
      // Script Processor (Deprecated but functional for raw PCM streaming in browser without complex worklet setup)
      // Buffer size 4096 = ~250ms latency chunk
      processorRef.current = inputContextRef.current.createScriptProcessor(4096, 1, 1);
      
      sourceRef.current.connect(inputAnalyserRef.current);
      inputAnalyserRef.current.connect(processorRef.current);
      processorRef.current.connect(inputContextRef.current.destination);

      const reportLanguageTool: FunctionDeclaration = {
        name: 'report_language',
        parameters: {
          type: Type.OBJECT,
          description: 'Reports the detected language of the user speech.',
          properties: {
            language: {
              type: Type.STRING,
              description: 'The name of the detected language (e.g., "French", "Spanish", "English").',
            },
          },
          required: ['language'],
        },
      };

      const systemInstruction = `
      You are an expert real-time translator. 
      The target language is: ${targetLanguage}.
      
      Protocol:
      1. Listen to the audio stream.
      2. If you hear speech, immediately detect the language.
      3. Call the 'report_language' tool with the language name.
      4. Translation Logic:
         - If Source is English -> Translate to ${targetLanguage}.
         - If Source is ${targetLanguage} -> Translate to English.
         - If Source is any other language -> Translate to English.
      5. Output ONLY the translated audio. Do not respond to the content or engage in conversation.
      6. Do not translate silence or background noise.
      `;

      sessionPromiseRef.current = ai.live.connect({
        model: GEMINI_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: systemInstruction,
          tools: [{ functionDeclarations: [reportLanguageTool] }],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setConnectionState(ConnectionState.CONNECTED);
            nextStartTimeRef.current = outputContextRef.current?.currentTime || 0;
            
            // Start processing audio
            if (processorRef.current) {
                processorRef.current.onaudioprocess = (e) => {
                    const inputData = e.inputBuffer.getChannelData(0);
                    const pcmBlob = createPcmBlob(inputData, AUDIO_INPUT_SAMPLE_RATE);
                    
                    if (sessionPromiseRef.current) {
                         sessionPromiseRef.current.then(session => {
                             session.sendRealtimeInput({ media: pcmBlob });
                         });
                    }
                };
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Tool Calls (Language Detection)
            if (message.toolCall) {
                for (const fc of message.toolCall.functionCalls) {
                    if (fc.name === 'report_language') {
                        const lang = (fc.args as any).language;
                        setDetectedLanguage(lang);
                        // Send success response
                        sessionPromiseRef.current?.then(session => {
                            session.sendToolResponse({
                                functionResponses: {
                                    id: fc.id,
                                    name: fc.name,
                                    response: { result: 'ok' }
                                }
                            });
                        });
                    }
                }
            }

            // Handle Transcriptions
            const inputTxt = message.serverContent?.inputTranscription?.text;
            const outputTxt = message.serverContent?.outputTranscription?.text;
            
            if (inputTxt) {
                currentInputTransRef.current += inputTxt;
            }
            if (outputTxt) {
                currentOutputTransRef.current += outputTxt;
            }

            if (message.serverContent?.turnComplete) {
                const userText = currentInputTransRef.current.trim();
                const modelText = currentOutputTransRef.current.trim();
                
                if (userText || modelText) {
                    setMessages(prev => [
                        ...prev, 
                        {
                            id: Date.now().toString(),
                            text: userText,
                            sender: 'user',
                            timestamp: Date.now()
                        },
                        {
                            id: (Date.now() + 1).toString(),
                            text: modelText,
                            sender: 'model',
                            timestamp: Date.now()
                        }
                    ]);
                }
                currentInputTransRef.current = '';
                currentOutputTransRef.current = '';
            }

            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputContextRef.current) {
                const ctx = outputContextRef.current;
                const audioData = base64ToUint8Array(base64Audio);
                const audioBuffer = await decodeAudioData(audioData, ctx, AUDIO_OUTPUT_SAMPLE_RATE);
                
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                
                // Connect to visualizer and output
                if (outputAnalyserRef.current) {
                    source.connect(outputAnalyserRef.current);
                    outputAnalyserRef.current.connect(ctx.destination);
                } else {
                    source.connect(ctx.destination);
                }
                
                // Schedule playback
                // Ensure we don't schedule in the past
                const now = ctx.currentTime;
                // Add a tiny buffer (0.05s) if we fell behind to prevent glitching
                if (nextStartTimeRef.current < now) {
                    nextStartTimeRef.current = now + 0.05;
                }
                
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                
                scheduledSourcesRef.current.add(source);
                source.onended = () => {
                    scheduledSourcesRef.current.delete(source);
                };
            }
          },
          onclose: () => {
             setConnectionState(ConnectionState.DISCONNECTED);
          },
          onerror: (err) => {
             console.error('Session error:', err);
             setConnectionState(ConnectionState.ERROR);
             disconnect(); // Clean up on error
          }
        }
      });

    } catch (error) {
      console.error('Connection failed:', error);
      setConnectionState(ConnectionState.ERROR);
    }
  }, [apiKey, targetLanguage, disconnect]);


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    connectionState,
    detectedLanguage,
    messages,
    inputAnalyser: inputAnalyserRef.current,
    outputAnalyser: outputAnalyserRef.current,
    connect,
    disconnect
  };
}