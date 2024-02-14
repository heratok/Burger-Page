

function LoadingPage() {
  return (
    <div className="flex items-center justify-center w-full min-h-screen ">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-white">Loading...</h1>
        <div className="w-32 h-32 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
      </div>
    </div>
  );
}

export default LoadingPage;
