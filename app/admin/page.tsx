'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { getToken } from 'next-auth/jwt';
// Timer type for intervals
type TimerHandle = ReturnType<typeof setInterval>;

export default function AdminPanel() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'usage' | 'invitations' | 'transcription' | 'llm'>('dashboard');
  
  // Dashboard state
  const [users, setUsers] = useState<any[]>([]);
  const [usageData, setUsageData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
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

  // Streaming transcription state
  const [isRecording, setIsRecording] = useState(false);
  const [streamTranscript, setStreamTranscript] = useState('');
  const [streamStatus, setStreamStatus] = useState('Ready');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [streamProvider, setStreamProvider] = useState('assemblyai-streaming');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);

  // Invitation state
  const [invitations, setInvitations] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  // Admin access control - VERY restrictive
  const ADMIN_EMAIL = 'nedeliss@gmail.com';
  const ADMIN_USER_ID = 'cmddieu5i000011zma5p761oo';
  
  const isAdmin = session?.user?.email === ADMIN_EMAIL || session?.user?.id === ADMIN_USER_ID;

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

      const response = await fetch('/api/v1/transcribe/transcribe', {
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

  const sendInvitation = async () => {
    if (!newInviteEmail.trim()) return;
    
    setInviteLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: newInviteEmail.trim()
        })
      });

      const result = await response.json();
      if (response.ok) {
        setNewInviteEmail('');
        fetchInvitations(); // Refresh list
        alert('Invitation sent successfully!');
      } else {
        alert(`Failed to send invitation: ${result.error}`);
      }
    } catch (error) {
      console.error('Invitation error:', error);
      alert('Failed to send invitation');
    } finally {
      setInviteLoading(false);
    }
  };

  const fetchInvitations = async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/admin/invitations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setInvitations(data.invitations || []);
        setLeads(data.leads || []);
      }
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    }
  };

  const testLLM = async () => {
    if (!llmInput.trim()) return;
    
    setLlmLoading(true);
    try {
      const token = await getAuthToken();
      
      const response = await fetch('/api/v1/llm/complete', {
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

  const startStreaming = async () => {
    try {
      setStreamStatus('Starting session...');
      
      // 1. Start streaming session
      const token = await getAuthToken();
      const response = await fetch('/api/v1/transcribe/stream/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider: streamProvider,
          language: 'en',
          sampleRate: 16000
        })
      });

      const sessionData = await response.json();
      setSessionId(sessionData.sessionId);
      
      // 2. Connect to WebSocket
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.host;
      const ws = new WebSocket(`${wsProtocol}//${wsHost}/ws`);
      websocketRef.current = ws;

      ws.onopen = () => {
        setStreamStatus('Authenticating...');
        ws.send(JSON.stringify({
          type: 'auth',
          token: token
        }));
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'auth_success':
            setStreamStatus('Starting transcription...');
            ws.send(JSON.stringify({
              type: 'start_transcription',
              provider: streamProvider,
              language: 'en',
              sessionId: sessionData.sessionId
            }));
            break;
            
          case 'transcription_started':
            setStreamStatus('Recording... Speak now!');
            setStreamTranscript(''); // Clear previous transcript
            startAudioRecording(sessionData.sessionId);
            break;
            
          case 'transcript':
            setStreamTranscript(prev => prev + ' ' + (message.data?.text || message.data || ''));
            break;
            
          case 'error':
            setStreamStatus(`Error: ${message.error}`);
            break;
        }
      };

    } catch (error) {
      setStreamStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const startAudioRecording = async (currentSessionId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      // Use Web Audio API to capture raw PCM data
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      source.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = (e) => {
        if (websocketRef.current?.readyState === WebSocket.OPEN && currentSessionId) {
          const inputBuffer = e.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);
          
          // Convert float32 to int16 PCM
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          
          // Convert to base64
          const uint8Array = new Uint8Array(pcmData.buffer);
          const base64Audio = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
          
          websocketRef.current.send(JSON.stringify({
            type: 'audio_data',
            sessionId: currentSessionId,
            audioData: base64Audio
          }));
        }
      };

      // Store references for cleanup
      (window as any).audioContext = audioContext;
      (window as any).processor = processor;
      (window as any).audioStream = stream;
      
      setIsRecording(true);
      
    } catch (error) {
      setStreamStatus(`Microphone error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const stopStreaming = () => {
    // Clean up Web Audio API resources
    if ((window as any).processor) {
      (window as any).processor.disconnect();
      (window as any).processor = null;
    }
    
    if ((window as any).audioContext) {
      (window as any).audioContext.close();
      (window as any).audioContext = null;
    }
    
    if ((window as any).audioStream) {
      (window as any).audioStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      (window as any).audioStream = null;
    }
    
    if (websocketRef.current && sessionId) {
      websocketRef.current.send(JSON.stringify({
        type: 'stop_session',
        sessionId: sessionId
      }));
      websocketRef.current.close();
    }
    
    setIsRecording(false);
    setStreamStatus('Stopped');
    setSessionId(null);
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      
      // Fetch all admin data
      const [usersRes, usageRes, statsRes] = await Promise.all([
        fetch('/api/v1/analytics/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/v1/analytics/usage', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/v1/analytics/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        console.log('Users data:', usersData);
        setUsers(usersData);
      }
      if (usageRes.ok) {
        const usageData = await usageRes.json();
        console.log('Usage data:', usageData);
        setUsageData(usageData);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        console.log('Stats data:', statsData);
        setStats(statsData);
      } else {
        console.error('Stats response not ok:', statsRes.status, await statsRes.text());
      }
      
      // Update last refreshed timestamp
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load data when component mounts and set up refresh interval
  useEffect(() => {
    let intervalId: TimerHandle;

    const initializeData = async () => {
      if (!isAdmin) return;
      
      await fetchDashboardData();
      
      // Set up auto-refresh every 30 seconds for real-time updates
      intervalId = setInterval(() => {
        fetchDashboardData();
      }, 30000);
    };

    if (status !== 'loading') {
      initializeData();
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isAdmin, status]);

  // Refresh data when switching to dashboard-related tabs
  useEffect(() => {
    if (status !== 'loading' && isAdmin && ['dashboard', 'users', 'usage'].includes(activeTab)) {
      fetchDashboardData();
    }
  }, [activeTab, isAdmin, status]);

  // Load invitations when switching to invitations tab
  useEffect(() => {
    if (status !== 'loading' && isAdmin && activeTab === 'invitations') {
      fetchInvitations();
    }
  }, [activeTab, isAdmin, status]);

  // Early returns after hooks
  if (status === 'loading') return <div className="p-8">Loading...</div>;
  if (!session) return <div className="p-8">Please log in to access the admin panel.</div>;
  
  if (!isAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h1 className="text-xl font-bold text-red-800 mb-2">Access Denied</h1>
          <p className="text-red-600">You do not have permission to access the admin panel.</p>
          <p className="text-sm text-red-500 mt-2">This incident has been logged.</p>
        </div>
      </div>
    );
  }

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
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'users', label: 'Users' },
            { id: 'usage', label: 'Usage' },
            { id: 'invitations', label: 'Invitations' },
            { id: 'transcription', label: 'Test Audio' },
            { id: 'llm', label: 'Test LLM' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2 px-3 rounded-md font-medium transition-colors text-sm ${
                activeTab === tab.id
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">System Overview</h2>
                <div className="flex items-center space-x-3">
                  {loading && (
                    <div className="flex items-center text-sm text-gray-500">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      Refreshing...
                    </div>
                  )}
                  <button
                    onClick={fetchDashboardData}
                    className="px-3 py-1 bg-blue-50 text-blue-600 rounded-md text-sm hover:bg-blue-100 transition-colors"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const token = await getAuthToken();
                        const response = await fetch('/api/v1/analytics/sync-usage-counts', {
                          method: 'POST',
                          headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (response.ok) {
                          const result = await response.json();
                          alert(`✅ ${result.message}`);
                          fetchDashboardData(); // Refresh data after sync
                        }
                      } catch (error) {
                        alert('❌ Failed to sync usage counts');
                      }
                    }}
                    className="px-3 py-1 bg-orange-50 text-orange-600 rounded-md text-sm hover:bg-orange-100 transition-colors"
                  >
                    Sync Usage
                  </button>
                </div>
              </div>
              {loading ? (
                <div className="text-center py-8">Loading dashboard data...</div>
              ) : (
                <div className="space-y-6">
                  {/* Core Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="font-medium text-blue-800">Total Users</h3>
                      <p className="text-2xl font-bold text-blue-600">{stats?.totalUsers || 0}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h3 className="font-medium text-green-800">Active (7d)</h3>
                      <p className="text-2xl font-bold text-green-600">{stats?.activeUsers7d || 0}</p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <h3 className="font-medium text-purple-800">Active (30d)</h3>
                      <p className="text-2xl font-bold text-purple-600">{stats?.activeUsers30d || 0}</p>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <h3 className="font-medium text-yellow-800">Total Cost</h3>
                      <p className="text-2xl font-bold text-yellow-600">${stats?.totalCost?.toFixed(4) || '0.0000'}</p>
                    </div>
                  </div>

                  {/* Signups & Trends */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-indigo-50 p-4 rounded-lg">
                      <h3 className="font-medium text-indigo-800">New Signups (This Month)</h3>
                      <div className="flex items-center space-x-2">
                        <p className="text-2xl font-bold text-indigo-600">{stats?.newSignupsThisMonth || 0}</p>
                        {stats?.signupTrend && (
                          <span className={`text-sm font-medium ${
                            stats.signupTrend > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {stats.signupTrend > 0 ? '↗' : '↘'} {Math.abs(stats.signupTrend).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="bg-cyan-50 p-4 rounded-lg">
                      <h3 className="font-medium text-cyan-800">Total Requests</h3>
                      <p className="text-2xl font-bold text-cyan-600">{stats?.totalRequests || 0}</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg">
                      <h3 className="font-medium text-red-800">Error Rate (7d)</h3>
                      <p className="text-2xl font-bold text-red-600">{stats?.errorRate?.toFixed(2) || '0.00'}%</p>
                    </div>
                  </div>

                  {/* Plan Breakdown */}
                  {stats?.planBreakdown && stats.planBreakdown.length > 0 && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-medium text-gray-800 mb-3">Plan Distribution</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {stats.planBreakdown.map((plan: any, index: number) => (
                          <div key={index} className="bg-white p-3 rounded text-center">
                            <div className="text-sm text-gray-600">{plan.plan}</div>
                            <div className="text-lg font-bold">{plan.count}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Service Breakdown */}
                  {stats?.serviceBreakdown && stats.serviceBreakdown.length > 0 && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-medium text-gray-800 mb-3">Service Usage</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {stats.serviceBreakdown.map((service: any, index: number) => (
                          <div key={index} className="bg-white p-3 rounded">
                            <div className="flex justify-between items-center">
                              <span className="font-medium capitalize">{service.service}</span>
                              <span className="text-sm text-gray-600">${service.cost?.toFixed(4) || '0.0000'}</span>
                            </div>
                            <div className="text-sm text-gray-500">{service.requests} requests</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Activity & Top Users */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Activity */}
                    {stats?.recentActivity && stats.recentActivity.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h3 className="font-medium mb-3">Recent Activity</h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {stats.recentActivity.slice(0, 8).map((activity: any, index: number) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <div>
                                <span className="font-medium">{activity.email}</span>
                                <span className="text-gray-500"> signed up</span>
                              </div>
                              <div className="text-xs text-gray-400">
                                {new Date(activity.signupTime).toLocaleDateString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top Users */}
                    {stats?.topUsers && stats.topUsers.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h3 className="font-medium mb-3">Top Users</h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {stats.topUsers.slice(0, 8).map((user: any, index: number) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <div>
                                <span className="font-medium">{user.email}</span>
                                <span className={`ml-2 px-1 py-0.5 rounded text-xs ${
                                  user.plan === 'cloud' ? 'bg-blue-100 text-blue-800' :
                                  user.plan === 'byok' ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {user.plan}
                                </span>
                              </div>
                              <div className="text-right">
                                <div className="font-medium">{user.usageCount}</div>
                                {user.lastActive && (
                                  <div className="text-xs text-gray-400">
                                    {new Date(user.lastActive).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">User Management</h2>
              <div className="flex items-center space-x-3">
                {loading && (
                  <div className="flex items-center text-sm text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Refreshing...
                  </div>
                )}
                <button
                  onClick={fetchDashboardData}
                  className="px-3 py-1 bg-blue-50 text-blue-600 rounded-md text-sm hover:bg-blue-100 transition-colors"
                >
                  Refresh
                </button>
              </div>
            </div>
            {loading ? (
              <div className="text-center py-8">Loading user data...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Email</th>
                      <th className="text-left p-2">Plan</th>
                      <th className="text-left p-2">Usage Count</th>
                      <th className="text-left p-2">Created</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center p-8 text-gray-500">
                          No users found
                        </td>
                      </tr>
                    ) : (
                      users.map((user: any) => (
                        <tr key={user.id} className="border-b hover:bg-gray-50">
                          <td className="p-2">{user.email}</td>
                          <td className="p-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              user.plan === 'cloud' ? 'bg-blue-100 text-blue-800' :
                              user.plan === 'byok' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {user.plan || 'free'}
                            </span>
                          </td>
                          <td className="p-2">{user.usageCount || 0}</td>
                          <td className="p-2">{new Date(user.createdAt).toLocaleDateString()}</td>
                          <td className="p-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              user.hasAccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {user.hasAccess ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Usage Tab */}
        {activeTab === 'usage' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Usage Analytics</h2>
              <div className="flex items-center space-x-3">
                {loading && (
                  <div className="flex items-center text-sm text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Refreshing...
                  </div>
                )}
                <button
                  onClick={fetchDashboardData}
                  className="px-3 py-1 bg-blue-50 text-blue-600 rounded-md text-sm hover:bg-blue-100 transition-colors"
                >
                  Refresh
                </button>
              </div>
            </div>
            {loading ? (
              <div className="text-center py-8">Loading usage data...</div>
            ) : (
              <div className="space-y-6">
                <div className="overflow-x-auto">
                  <table className="w-full table-auto text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Time</th>
                        <th className="text-left p-2">User</th>
                        <th className="text-left p-2">Service</th>
                        <th className="text-left p-2">Provider</th>
                        <th className="text-left p-2">Cost</th>
                        <th className="text-left p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageData.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center p-8 text-gray-500">
                            No usage data found
                          </td>
                        </tr>
                      ) : (
                        usageData.slice(0, 20).map((usage: any) => (
                          <tr key={usage.id} className="border-b hover:bg-gray-50">
                            <td className="p-2">{new Date(usage.createdAt).toLocaleString()}</td>
                            <td className="p-2">{usage.user?.email || 'Unknown'}</td>
                            <td className="p-2">
                              <span className={`px-2 py-1 rounded text-xs ${
                                usage.serviceType === 'transcription' ? 'bg-blue-100 text-blue-800' :
                                'bg-purple-100 text-purple-800'
                              }`}>
                                {usage.serviceType}
                              </span>
                            </td>
                            <td className="p-2">{usage.provider}</td>
                            <td className="p-2">${usage.totalCostUsd?.toFixed(4) || '0.0000'}</td>
                            <td className="p-2">
                              <span className={`px-2 py-1 rounded text-xs ${
                                usage.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {usage.success ? 'Success' : 'Failed'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Invitations Tab */}
        {activeTab === 'invitations' && (
          <div className="space-y-6">
            {/* Send Invitation */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-6">Send Invitation</h2>
              
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={newInviteEmail}
                    onChange={(e) => setNewInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={sendInvitation}
                  disabled={!newInviteEmail.trim() || inviteLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {inviteLoading ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </div>

            {/* Active Invitations */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Active Invitations</h2>
                <button
                  onClick={fetchInvitations}
                  className="px-3 py-1 bg-blue-50 text-blue-600 rounded-md text-sm hover:bg-blue-100 transition-colors"
                >
                  Refresh
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full table-auto text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Email</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Expires</th>
                      <th className="text-left p-2">Created</th>
                      <th className="text-left p-2">Used By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center p-8 text-gray-500">
                          No invitations found
                        </td>
                      </tr>
                    ) : (
                      invitations.map((invite: any) => (
                        <tr key={invite.id} className="border-b hover:bg-gray-50">
                          <td className="p-2">{invite.email}</td>
                          <td className="p-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              invite.used ? 'bg-green-100 text-green-800' :
                              new Date(invite.expiresAt) < new Date() ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {invite.used ? 'Used' : 
                               new Date(invite.expiresAt) < new Date() ? 'Expired' : 'Pending'}
                            </span>
                          </td>
                          <td className="p-2">{new Date(invite.expiresAt).toLocaleDateString()}</td>
                          <td className="p-2">{new Date(invite.createdAt).toLocaleDateString()}</td>
                          <td className="p-2">{invite.usedBy || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Waitlist (People who tried to sign up) */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-6">Waitlist (Unauthorized Sign-up Attempts)</h2>
              
              <div className="overflow-x-auto">
                <table className="w-full table-auto text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Email</th>
                      <th className="text-left p-2">First Attempt</th>
                      <th className="text-left p-2">Last Attempt</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center p-8 text-gray-500">
                          No waitlist entries
                        </td>
                      </tr>
                    ) : (
                      leads.map((lead: any) => (
                        <tr key={lead.id} className="border-b hover:bg-gray-50">
                          <td className="p-2">{lead.email}</td>
                          <td className="p-2">{new Date(lead.createdAt).toLocaleDateString()}</td>
                          <td className="p-2">{new Date(lead.updatedAt).toLocaleDateString()}</td>
                          <td className="p-2">
                            <button
                              onClick={() => setNewInviteEmail(lead.email)}
                              className="px-2 py-1 bg-green-50 text-green-600 rounded text-xs hover:bg-green-100"
                            >
                              Invite
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Transcription Tab */}
        {activeTab === 'transcription' && (
          <div className="space-y-6">
            {/* Streaming Transcription */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-6">🎤 Streaming Transcription</h2>
              
              <div className="space-y-4">
                {/* Provider Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Streaming Provider
                  </label>
                  <select
                    value={streamProvider}
                    onChange={(e) => setStreamProvider(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    disabled={isRecording}
                  >
                    <option value="assemblyai-streaming">AssemblyAI (Streaming)</option>
                    <option value="deepgram-nova3">Deepgram Nova (Streaming)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Only streaming-capable providers shown</p>
                </div>

                <div className="flex items-center space-x-4">
                  <button
                    onClick={isRecording ? stopStreaming : startStreaming}
                    className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                      isRecording 
                        ? 'bg-red-600 text-white hover:bg-red-700' 
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isRecording ? '🛑 Stop Recording' : '🎤 Start Recording'}
                  </button>
                  
                  <div className={`px-3 py-1 rounded text-sm font-medium ${
                    streamStatus.includes('Error') ? 'bg-red-100 text-red-800' :
                    streamStatus.includes('Recording') ? 'bg-green-100 text-green-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {streamStatus}
                  </div>
                </div>

                {streamTranscript && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded">
                    <h4 className="text-sm font-medium text-green-800 mb-2">Transcript:</h4>
                    <p className="text-green-700">{streamTranscript}</p>
                  </div>
                )}

                {sessionId && (
                  <div className="text-xs text-gray-500">
                    Session ID: {sessionId}
                  </div>
                )}
              </div>
            </div>

            {/* File Upload Transcription */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-6">📁 File Upload Transcription</h2>
            
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
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
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
          {lastUpdated && (
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  Last data refresh: {lastUpdated.toLocaleString()}
                </span>
                <span className="text-blue-600">Auto-refresh: 30s</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}