function Home() {
  const projectName = document.title || 'Your Project';

  return (
    <div>
      <h1>Welcome to {projectName}</h1>
      <p>Your full-stack Django + React application is ready.</p>
    </div>
  )
}

export default Home
