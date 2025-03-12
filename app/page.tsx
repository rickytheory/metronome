import { Metronome } from "@/components/Metronome"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background">
      {/* <h1 className="text-4xl font-bold mb-8">Metronome</h1> */}
      <Metronome />
    </main>
  )
}
