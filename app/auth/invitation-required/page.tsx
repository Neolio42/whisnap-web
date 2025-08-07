export default function InvitationRequired() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
            <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.96-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Invitation Required
        </h1>
        
        <p className="text-gray-600 mb-6">
          Whisnap is currently in private beta. You need an invitation to create an account.
        </p>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            If you believe you should have access, please contact the administrator.
          </p>
          
          <a
            href="/api/auth/signin"
            className="inline-block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Back to Sign In
          </a>
        </div>
      </div>
    </div>
  );
}