'use client';

import { useSearchParams } from 'next/navigation';

export default function InvitationRequired() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full bg-white rounded-xl shadow-xl p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Whisnap is Invite-Only
        </h1>
        
        <p className="text-lg text-gray-600 mb-6">
          We're currently in private beta 🚀
        </p>
        
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-900 font-medium mb-2">
            ✨ You're on the waitlist!
          </p>
          <p className="text-sm text-blue-700">
            We've recorded your email and will send you an invitation when a spot opens up.
          </p>
        </div>
        
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Already have an invitation? Make sure you're using the same email address that received the invite.
          </p>
          
          <a
            href="/"
            className="inline-block w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 font-medium"
          >
            Back to Home
          </a>
          
          <a
            href="/api/auth/signin"
            className="inline-block w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            Try Again
          </a>
        </div>
      </div>
    </div>
  );
}