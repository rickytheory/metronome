"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import confetti from 'canvas-confetti';

// Sound parameters
const SOUNDS = {
  downbeat: {
    frequency: 1200, // Hz - higher pitch for downbeat
    gainMultiplier: 1.0, // Full volume for downbeat
  },
  otherBeats: {
    frequency: 800, // Hz - lower pitch for other beats
    gainMultiplier: 0.7, // 70% volume for other beats
  },
} as const;

// ADSR envelope parameters
const ENVELOPE = {
  attack: 0.001, // 1ms attack for sharp initial hit
  decay: 0.0, // no decay
  sustain: 1, // full sustain
  release: 0.05, // 50ms release
} as const;

interface TimeSignature {
  beats: number;
  value: "4" | "8";  // denominator of time signature
}

// Add a constant to help organize our time signatures
const TIME_SIGNATURES = [
  { display: "2/4", beats: 2, value: "4" },
  { display: "3/4", beats: 3, value: "4" },
  { display: "4/4", beats: 4, value: "4" },
  { display: "5/4", beats: 5, value: "4" },
  { display: "6/8", beats: 6, value: "8" },
  { display: "7/8", beats: 7, value: "8" },
  { display: "9/8", beats: 9, value: "8" },
] as const;

// Add tempo markings constant at the top with the other constants
const TEMPO_MARKS = [
  { name: "Largo", tempo: 40 },
  { name: "Adagio", tempo: 60 },
  { name: "Andante", tempo: 76 },
  { name: "Moderato", tempo: 108 },
  { name: "Allegro", tempo: 120 },
  { name: "Vivace", tempo: 168 },
  { name: "Presto", tempo: 208 },
] as const;

// Easter egg tempo ranges
const EASTER_EGG_TEMPOS = [
  { name: "Super Fast", min: 209, max: 299 },
  { name: "Light Speed", min: 300, max: 382 },
  { name: "Ridiculous", min: 383, max: 465 },
  { name: "Ludicrous", min: 466, max: 549 },
  { name: "You Win!", min: 550, max: 10000 },
] as const;

// Helper function to get tempo name
const getTempoName = (tempo: number) => {
  // Check easter egg tempos first
  const easterEggTempo = EASTER_EGG_TEMPOS.find(
    mark => tempo >= mark.min && tempo <= mark.max
  );
  if (easterEggTempo) return easterEggTempo.name;

  // Fall back to regular tempo marks
  return TEMPO_MARKS.find(mark => 
    mark.tempo >= tempo)?.name || TEMPO_MARKS[TEMPO_MARKS.length - 1].name;
};

// Helper function to get color based on tempo
const getTempoColor = (tempo: number) => {
  if (tempo <= 208) return 'inherit';
  if (tempo >= 550) return '#FF3333'; // Bright hot red
  
  // Calculate how "hot" the tempo is between 208 and 550
  const hotness = (tempo - 208) / (550 - 208);
  
  // Start from black and gradually increase red, then make it brighter
  const red = Math.round(255 * hotness);
  // Add a small amount of green/blue for the glow effect at higher temps
  // const greenBlue = Math.round(51 * Math.max(0, hotness - 0.8));
  const greenBlue = 0;
  
  return `rgb(${red}, ${greenBlue}, ${greenBlue})`;
};

// Helper function to get font size based on tempo
const getTempoSize = (tempo: number) => {
  if (tempo <= 208) return '2.25rem'; // text-4xl default
  if (tempo >= 550) return '4rem';
  
  // Calculate size increase between 208 and 550
  const scale = (tempo - 208) / (550 - 208);
  const size = 2.25 + (scale * 1.75); // Scale from 2.25rem to 4rem
  
  return `${size}rem`;
};

export function Metronome() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempo] = useState(120);
  const [volume, setVolume] = useState(0.5);
  const [timeSignature, setTimeSignature] = useState<TimeSignature>({ beats: 4, value: "4" });
  const [currentBeat, setCurrentBeat] = useState(0);
  const [hasWon, setHasWon] = useState(false);
  const [showVictoryBanner, setShowVictoryBanner] = useState(false);
  const winLockoutRef = useRef<number | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const nextBeatRef = useRef(0);
  const tempoRef = useRef(tempo);
  const volumeRef = useRef(volume);
  
  // Tap tempo refs
  const tapTimesRef = useRef<number[]>([]);
  const tapTimeoutRef = useRef<number | null>(null);

  // Initialize AudioContext on first user interaction
  const ensureAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    } else if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, []);

  // Update refs when values change
  useEffect(() => {
    tempoRef.current = tempo;
  }, [tempo]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const playClick = (beatNumber: number) => {
    if (!audioContextRef.current) return;

    const now = audioContextRef.current.currentTime;
    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);

    // Set frequency and gain based on whether it's the downbeat
    const soundParams = beatNumber === 0 ? SOUNDS.downbeat : SOUNDS.otherBeats;
    const beatVolume = volumeRef.current * soundParams.gainMultiplier;

    // Initial gain
    gainNode.gain.setValueAtTime(0, now);

    // Attack
    gainNode.gain.linearRampToValueAtTime(beatVolume, now + ENVELOPE.attack);

    // Decay and Sustain
    gainNode.gain.linearRampToValueAtTime(
      beatVolume * ENVELOPE.sustain,
      now + ENVELOPE.attack + ENVELOPE.decay
    );

    // Release
    gainNode.gain.linearRampToValueAtTime(
      0,
      now + ENVELOPE.attack + ENVELOPE.decay + ENVELOPE.release
    );

    oscillator.frequency.value = soundParams.frequency;

    oscillator.start(now);
    oscillator.stop(now + ENVELOPE.attack + ENVELOPE.decay + ENVELOPE.release);
  };

  // Calculate effective tempo based on time signature
  const getEffectiveTempo = () => {
    // For eighth note time signatures, double the tempo
    const actualTempo = timeSignature.value === "8" ? tempoRef.current * 2 : tempoRef.current;
    
    // No longer capping the tempo, allowing for easter egg speeds
    return actualTempo;
  };

  const startMetronome = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    const effectiveTempo = getEffectiveTempo();
    // Add a safety check to prevent extremely fast intervals that could crash the browser
    const intervalMs = Math.max((60 / effectiveTempo) * 1000, 10); // Minimum 10ms interval
    
    // Play the first beat immediately
    playClick(nextBeatRef.current);
    setCurrentBeat(nextBeatRef.current);
    nextBeatRef.current = (nextBeatRef.current + 1) % timeSignature.beats;

    // Set up the interval for subsequent beats
    timerRef.current = window.setInterval(() => {
      playClick(nextBeatRef.current);
      setCurrentBeat(nextBeatRef.current);
      nextBeatRef.current = (nextBeatRef.current + 1) % timeSignature.beats;
    }, intervalMs);
  };

  const startStop = () => {
    ensureAudioContext();
    
    if (isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsPlaying(false);
      setCurrentBeat(0);
      nextBeatRef.current = 0;
    } else {
      setIsPlaying(true);
      setCurrentBeat(0);
      nextBeatRef.current = 0;
      
      // Small delay to ensure AudioContext is ready
      setTimeout(() => {
        startMetronome();
      }, 300);
    }
  };

  // Effect to handle playing state
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [isPlaying]);

  const handleTapTempo = () => {
    // If we're in the win lockout period, ignore taps
    if (winLockoutRef.current) return;

    const now = performance.now();
    const tapTimes = tapTimesRef.current;

    // Clear tap history if it's been more than 1 second since last tap
    // Reduced from 2 seconds to 1 second to be more strict
    if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > 1000) {
      tapTimes.length = 0;
    }

    // Add current tap time
    tapTimes.push(now);

    // Keep only the last 3 taps
    if (tapTimes.length > 3) {
      tapTimes.shift();
    }

    // Calculate tempo if we have at least 2 taps
    if (tapTimes.length >= 2) {
      // Calculate intervals between taps
      const intervals = [];
      for (let i = 1; i < tapTimes.length; i++) {
        intervals.push(tapTimes[i] - tapTimes[i - 1]);
      }

      // Calculate average interval
      const averageInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      
      // Convert to BPM (60000 ms = 1 minute)
      const newTempo = Math.round(60000 / averageInterval);
      
      // Add reasonable limits to prevent unrealistic tempos
      // Most humans can't tap faster than about 800 BPM
      const clampedTempo = Math.min(Math.max(newTempo, 40), 800);
      
      setTempo(clampedTempo);
      
      // If playing, update the metronome timing
      if (isPlaying) {
        // Clear the old timeout to prevent rapid updates
        if (tapTimeoutRef.current) {
          clearTimeout(tapTimeoutRef.current);
        }
        
        // Wait a short moment before updating the metronome to allow for multiple taps
        tapTimeoutRef.current = window.setTimeout(() => {
          startMetronome();
        }, 250);
      }
    }
  };

  // Modified win state effect
  useEffect(() => {
    // Clear any existing timeouts first
    if (winLockoutRef.current) {
      clearTimeout(winLockoutRef.current);
      winLockoutRef.current = null;
    }

    if (tempo >= 550 && !hasWon) {
      setHasWon(true);
      setShowVictoryBanner(true);
      
      // Set win lockout
      winLockoutRef.current = window.setTimeout(() => {
        winLockoutRef.current = null;
        // Also reset hasWon state to allow for multiple wins
        setHasWon(false);
      }, 2000);

      // Trigger confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      // Add a few more bursts for extra effect
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        });
      }, 200);
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        });
      }, 400);

      // Hide victory banner after 2 seconds
      setTimeout(() => {
        setShowVictoryBanner(false);
      }, 2000);
    } else if (tempo < 550) {
      setHasWon(false);
      setShowVictoryBanner(false);
    }

    return () => {
      if (winLockoutRef.current) {
        clearTimeout(winLockoutRef.current);
        winLockoutRef.current = null;
      }
    };
  }, [hasWon, tempo]);

  return (
    <div className="flex flex-col items-center gap-8 p-8 rounded-lg border bg-card text-card-foreground shadow-sm w-[400px]">
      <div className="flex flex-col items-center gap-1">
        <div className="h-[6rem] flex items-center justify-center relative">
          {showVictoryBanner && (
            <div 
              className="absolute top-0 left-0 right-0 -translate-y-full bg-green-500 text-white py-2 px-4 rounded-t-lg text-center font-bold animate-bounce"
              style={{
                animation: 'bounce 0.5s infinite'
              }}
            >
              YOU WIN!
            </div>
          )}
          <div 
            className="font-bold transition-all duration-200"
            style={{
              fontSize: getTempoSize(tempo),
              color: getTempoColor(tempo),
              // textShadow: tempo > 208 ? `0 0 ${Math.min((tempo - 208) / 10, 20)}px ${getTempoColor(tempo)}` : 'none',
            }}
          >
            {tempo} BPM
          </div>
        </div>
        {timeSignature.value === "8" && (
          <div className="text-sm text-muted-foreground">
            (playing at {tempo * 2} BPM for eighth notes)
          </div>
        )}
      </div>

      <div className="w-full max-w-xs space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium">Tempo</label>
          <Button
            variant="outline"
            size="sm"
            onMouseDown={handleTapTempo}
            onTouchStart={handleTapTempo}
            className="px-4"
          >
            Tap
          </Button>
        </div>
        <Slider
          value={[Math.min(tempo, 208)]}
          onValueChange={(values: number[]) => setTempo(values[0])}
          onValueCommit={() => {
            if (isPlaying) {
              startMetronome();
            }
          }}
          min={40}
          max={208}
          step={1}
          className="w-full"
        />
        <div className="text-sm text-muted-foreground text-center">
          {getTempoName(tempo)}
        </div>
      </div>

      <div className="w-full max-w-xs space-y-2">
        <label className="text-sm font-medium">Time Signature</label>
        <Select
          value={`${timeSignature.beats}/${timeSignature.value}`}
          onValueChange={(value: string) => {
            const [beats, noteValue] = value.split("/");
            const newTimeSignature = {
              beats: parseInt(beats),
              value: noteValue as "4" | "8"
            };
            setTimeSignature(newTimeSignature);
            
            if (isPlaying) {
              // Stop the current interval
              if (timerRef.current) {
                clearInterval(timerRef.current);
              }
              
              // Calculate the new interval based on the new time signature
              const effectiveTempo = newTimeSignature.value === "8" ? tempoRef.current * 2 : tempoRef.current;
              const intervalMs = (60 / effectiveTempo) * 1000;
              
              // Reset beat counter
              nextBeatRef.current = 0;
              setCurrentBeat(0);
              
              // Start the new interval
              timerRef.current = window.setInterval(() => {
                playClick(nextBeatRef.current);
                setCurrentBeat(nextBeatRef.current);
                nextBeatRef.current = (nextBeatRef.current + 1) % newTimeSignature.beats;
              }, intervalMs);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select time signature" />
          </SelectTrigger>
          <SelectContent>
            {TIME_SIGNATURES.map((sig) => (
              <SelectItem 
                key={sig.display} 
                value={sig.display}
              >
                {sig.display}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-full max-w-xs space-y-2">
        <label className="text-sm font-medium">Volume</label>
        <Slider
          value={[volume]}
          onValueChange={(values: number[]) => setVolume(values[0])}
          min={0}
          max={1}
          step={0.01}
          className="w-full"
        />
      </div>

      <div className="flex gap-4">
        <Button
          size="lg"
          onClick={startStop}
          variant={isPlaying ? "destructive" : "default"}
        >
          {isPlaying ? "Stop" : "Start"}
        </Button>
      </div>

      <div className="flex gap-2">
        {Array.from({ length: timeSignature.beats }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full ${
              currentBeat === i ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
