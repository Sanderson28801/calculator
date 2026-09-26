import Calculator from './components/Calculator';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start px-4 py-12 sm:py-16 selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-md flex flex-col items-center mb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
          Calculator
        </h1>
        
      </div>

      <Calculator />
    </main>
  );
}
