import DataFetcher from '@/components/DataFetcher';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow-sm rounded-lg p-6">
          <h1 className="text-2xl font-bold mb-6 text-gray-900">FastAPI Data Fetcher</h1>
          <DataFetcher />
        </div>
      </div>
    </main>
  );
}
