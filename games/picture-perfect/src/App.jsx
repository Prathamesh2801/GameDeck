import Header from "./components/Header.jsx";
import Quiz from "./components/Quiz.jsx";

function App() {
  return (
    <>
      <div className="min-h-screen flex flex-col p-3 sm:p-6 md:p-8">
        <Header />
        <main className="flex-1   flex-col  items-center justify-center flex">
          <Quiz />
        </main>
      </div>
    </>
  );
}

export default App;
