"use client";

import React, { ReactElement } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Settings2 } from "lucide-react";
import confetti from "canvas-confetti";

// Sound parameters
const SOUNDS = {
  accent: {
    frequency: 1200, // Hz - higher pitch for accent
    gainMultiplier: 1.0, // Full volume for accent
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
  value: "4" | "8" | "none"; // denominator of time signature
}

// Add a constant to help organize our time signatures
const TIME_SIGNATURES = [
  { display: "None", beats: 1, value: "none" },
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
  { name: "Adagio", tempo: 66 },
  { name: "Andante", tempo: 76 },
  { name: "Moderato", tempo: 108 },
  { name: "Allegro", tempo: 120 },
  { name: "Vivace", tempo: 168 },
  { name: "Presto", tempo: 280 },
] as const;

// Easter egg tempo ranges - adjusted for the new max tempo
const EASTER_EGG_TEMPOS = [
  { name: "Super Fast", min: 281, max: 350 },
  { name: "Light Speed", min: 351, max: 415 },
  { name: "Ridiculous", min: 416, max: 480 },
  { name: "Ludicrous", min: 481, max: 549 },
  { name: "You Win!", min: 550, max: 10000 },
] as const;

// Add new type at the top with other interfaces
type NoteType = "quarter" | "dottedQuarter" | "eighth";

// Add helper function to calculate displayed tempo
const getDisplayTempo = (baseTempo: number, noteType: NoteType, timeSignature: TimeSignature) => {
  // For /8 time signatures, the base tempo is in eighth notes
  if (timeSignature.value === "8") {
    switch (noteType) {
      case "quarter":
        return Math.round(baseTempo / 2); // Quarter note = half the eighth note tempo
      case "dottedQuarter":
        return Math.round(baseTempo / 3); // Dotted quarter = one third the eighth note tempo
      case "eighth":
        return baseTempo; // Base tempo is already in eighth notes
      default:
        return baseTempo;
    }
  } else {
    // For /4 time signatures, the base tempo is in quarter notes
    switch (noteType) {
      case "dottedQuarter":
        return Math.round(baseTempo * 2/3); // Dotted quarter is 2/3 the quarter note tempo
      case "eighth":
        return baseTempo * 2; // Eighth notes are twice as fast as quarter notes
      default:
        return baseTempo;
    }
  }
};

// Helper function to get tempo name
const getTempoName = (tempo: number) => {
  // Check easter egg tempos first
  const easterEggTempo = EASTER_EGG_TEMPOS.find(
    (mark) => tempo >= mark.min && tempo <= mark.max
  );
  if (easterEggTempo) return easterEggTempo.name;

  // Fall back to regular tempo marks
  return (
    TEMPO_MARKS.find((mark) => mark.tempo >= tempo)?.name ||
    TEMPO_MARKS[TEMPO_MARKS.length - 1].name
  );
};

// Helper function to get color based on tempo
const getTempoColor = (tempo: number) => {
  if (tempo <= 280) return "inherit";
  if (tempo >= 550) return "#FF3333"; // Bright hot red

  // Calculate how "hot" the tempo is between 280 and 550
  const hotness = (tempo - 280) / (550 - 280);

  // Start from black and gradually increase red
  const red = Math.round(255 * hotness);
  const greenBlue = 0;

  return `rgb(${red}, ${greenBlue}, ${greenBlue})`;
};

// Helper function to get font size based on tempo
const getTempoSize = (tempo: number) => {
  if (tempo <= 280) return "2.25rem"; // text-4xl default
  if (tempo >= 550) return "3rem";

  // Calculate size increase between 280 and 550
  const scale = (tempo - 280) / (550 - 280);
  const size = 2.25 + scale * 1; // Scale from 2.25rem to 4rem

  return `${size}rem`;
};

// Add helper function to determine available note types
const getAvailableNoteTypes = (timeSignature: TimeSignature): NoteType[] => {
  if (timeSignature.value === "none") return ["quarter"];
  if (timeSignature.value === "4") return ["quarter"];
  if (timeSignature.value === "8") {
    const isDivisibleBy3 = timeSignature.beats % 3 === 0;
    const isDivisibleBy2 = timeSignature.beats % 2 === 0;
    
    if (isDivisibleBy3) {
      // For 6/8, 9/8, 12/8 etc.
      return isDivisibleBy2 
        ? ["quarter", "dottedQuarter", "eighth"] // 6/8, 12/8
        : ["dottedQuarter", "eighth"]; // 9/8
    } else {
      // For other /8 time signatures
      return isDivisibleBy2
        ? ["quarter", "eighth"] // 8/8
        : ["eighth"]; // 5/8, 7/8
    }
  }
  return ["quarter"]; // fallback
};

export function Metronome() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempo] = useState(120);
  const [volume, setVolume] = useState(0.5);
  const [hasFlashSupport, setHasFlashSupport] = useState(false);
  const [useFlash, setUseFlash] = useState(false);
  const [hasVibrationSupport, setHasVibrationSupport] = useState(false);
  const [useVibration, setUseVibration] = useState(false);
  const [timeSignature, setTimeSignature] = useState<TimeSignature>({
    beats: 4,
    value: "4",
  });
  const [accentBeats, setAccentBeats] = useState<boolean[]>([
    true,
    false,
    false,
    false,
  ]); // First beat is accented by default
  const [currentBeat, setCurrentBeat] = useState(0);
  const [hasWon, setHasWon] = useState(false);
  const [showVictoryBanner, setShowVictoryBanner] = useState(false);
  const winLockoutRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const nextBeatRef = useRef(0);
  const tempoRef = useRef(tempo);
  const volumeRef = useRef(volume);
  const accentBeatsRef = useRef(accentBeats);
  const isFirstClickRef = useRef(true);

  // Tap tempo refs
  const tapTimesRef = useRef<number[]>([]);
  const tapTimeoutRef = useRef<number | null>(null);

  // Add new state for the selected note type
  const [selectedNoteType, setSelectedNoteType] = useState<NoteType>("quarter");

  // Initialize AudioContext on first user interaction
  const ensureAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    } else if (audioContextRef.current.state === "suspended") {
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

  useEffect(() => {
    accentBeatsRef.current = accentBeats;
  }, [accentBeats]);

  // Check for flash support without requesting permissions
  useEffect(() => {
    async function checkFlashPossible() {
      try {
        // First check if torch is even in supported constraints
        const constraints = navigator.mediaDevices.getSupportedConstraints();
        // @ts-expect-error - torch is a valid constraint but not in TypeScript types
        if (!constraints.torch) {
          setHasFlashSupport(false);
          return;
        }

        // Then check if we can enumerate devices without requesting permissions
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCamera = devices.some(device => device.kind === 'videoinput');
        setHasFlashSupport(hasCamera);
      } catch (error) {
        console.log("Flash check failed:", error);
        setHasFlashSupport(false);
      }
    }
    checkFlashPossible();
  }, []);

  // Check for actual flash support only when user enables the feature
  const checkFlashSupport = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities();

      // Store refs for later use
      mediaStreamRef.current = stream;
      trackRef.current = track;

      // @ts-expect-error - torch is a valid capability but not in TypeScript types
      const hasSupport = !!capabilities.torch;
      
      // If no actual torch support, clean up
      if (!hasSupport) {
        track.stop();
        mediaStreamRef.current = null;
        trackRef.current = null;
        setUseFlash(false);
      }
      setHasFlashSupport(hasSupport);
    } catch (error) {
      console.log("Flash not supported:", error);
      setHasFlashSupport(false);
      setUseFlash(false);
    }
  };

  // Effect to handle flash permission and cleanup
  useEffect(() => {
    if (useFlash) {
      checkFlashSupport();
    }

    // Cleanup function
    return () => {
      if (trackRef.current) {
        trackRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      mediaStreamRef.current = null;
      trackRef.current = null;
    };
  }, [useFlash]);

  // Update accent beats when time signature changes
  useEffect(() => {
    setAccentBeats((prev) => {
      const newAccents = new Array(timeSignature.beats).fill(false);
      newAccents[0] = true; // First beat is always accented by default
      // Copy over existing accents if they fit
      for (let i = 0; i < Math.min(prev.length, timeSignature.beats); i++) {
        newAccents[i] = prev[i];
      }
      return newAccents;
    });
  }, [timeSignature.beats]);

  // Flash control effect
  useEffect(() => {
    if (!hasFlashSupport || !trackRef.current) return;

    async function toggleFlash(on: boolean) {
      try {
        await trackRef.current?.applyConstraints({
          // @ts-expect-error - torch is a valid constraint but not in TypeScript types
          advanced: [{ torch: on }],
        });
      } catch (error) {
        console.error("Error toggling flash:", error);
      }
    }

    // Turn off flash when stopping or component unmounts
    if (!isPlaying) {
      toggleFlash(false);
    }
  }, [isPlaying, hasFlashSupport]);

  // Check for vibration support
  useEffect(() => {
    // More robust check for vibration support
    const hasSupport = typeof window !== 'undefined' && 
      'vibrate' in navigator && 
      typeof navigator.vibrate === 'function' &&
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent); // Only enable on mobile devices
    
    console.log('Vibration support check:', {
      hasWindow: typeof window !== 'undefined',
      hasVibrateProperty: 'vibrate' in navigator,
      isVibrateFunction: typeof navigator.vibrate === 'function',
      isMobileDevice: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
      finalResult: hasSupport
    });

    setHasVibrationSupport(hasSupport);
  }, []);

  // Function to handle vibration
  const vibrate = (isAccent: boolean) => {
    if (!useVibration || !hasVibrationSupport) return;
    
    try {
      if (isAccent) {
        navigator.vibrate(100); // Longer pulse for downbeat
      } else {
        navigator.vibrate(50); // Shorter pulse for other beats
      }
    } catch (error) {
      console.error('Vibration failed:', error);
      setHasVibrationSupport(false);
    }
  };

  const playClick = (beatNumber: number) => {
    if (!audioContextRef.current) return;

    const now = audioContextRef.current.currentTime;
    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);

    // Set frequency and gain based on whether it's an accent
    const soundParams = accentBeatsRef.current[beatNumber]
      ? SOUNDS.accent
      : SOUNDS.otherBeats;
    const beatVolume = volumeRef.current * soundParams.gainMultiplier;

    // Vibrate if enabled
    vibrate(accentBeatsRef.current[beatNumber]);

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

    // Handle flash slightly before the sound
    if (hasFlashSupport && useFlash && trackRef.current) {
      // Schedule flash to start 20ms before the sound
      const flashDelay = Math.max(
        0,
        (now - audioContextRef.current.currentTime) * 1000 - 20
      );
      setTimeout(async () => {
        try {
          // Use full brightness for accented beats, reduced for others
          const intensity = accentBeatsRef.current[beatNumber] ? 1.0 : 0.1;
          await trackRef.current?.applyConstraints({
            // @ts-expect-error - torch is a valid constraint but not in TypeScript types
            advanced: [{ torch: true, intensity }],
          });
          setTimeout(async () => {
            await trackRef.current?.applyConstraints({
              // @ts-expect-error - torch is a valid constraint but not in TypeScript types
              advanced: [{ torch: false }],
            });
          }, 50); // 50ms flash duration
        } catch (error) {
          console.error("Error toggling flash:", error);
        }
      }, flashDelay);
    }

    oscillator.start(now);
    oscillator.stop(now + ENVELOPE.attack + ENVELOPE.decay + ENVELOPE.release);
  };

  const startMetronome = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    // Add a safety check to prevent extremely fast intervals that could crash the browser
    const intervalMs = Math.max((60 / tempoRef.current) * 1000, 10); // Minimum 10ms interval

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

    // Test vibration on start if enabled
    if (!isPlaying && useVibration) {
      vibrate(true);
    }

    if (isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsPlaying(false);
      setCurrentBeat(0);
      nextBeatRef.current = 0;
    } else {
      setIsPlaying(true);
      setCurrentBeat(0);
      nextBeatRef.current = 0;

      if (isFirstClickRef.current) {
        // First click after load - use timeout
        setTimeout(() => {
          startMetronome();
        }, 500);
        isFirstClickRef.current = false;
      } else {
        // Subsequent clicks - start immediately
        startMetronome();
      }
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
      const averageInterval =
        intervals.reduce((a, b) => a + b, 0) / intervals.length;

      // Convert to BPM (60000 ms = 1 minute)
      const newTempo = Math.round(60000 / averageInterval);

      // Add reasonable limits to prevent unrealistic tempos
      // Most humans can't tap faster than about 800 BPM
      const clampedTempo = Math.min(Math.max(newTempo, 40), 800);

      setTempo(clampedTempo);

      // Check if this new tempo would trigger a win
      if (clampedTempo >= 550 && !hasWon) {
        setHasWon(true);
        setShowVictoryBanner(true);

        // Set win lockout
        if (winLockoutRef.current) {
          clearTimeout(winLockoutRef.current);
        }
        winLockoutRef.current = window.setTimeout(() => {
          winLockoutRef.current = null;
          setHasWon(false);
        }, 2000);

        // Trigger confetti
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
        // Add a few more bursts for extra effect
        setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
          });
        }, 200);
        setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
          });
        }, 400);

        // Hide victory banner after 2 seconds
        setTimeout(() => {
          setShowVictoryBanner(false);
        }, 2000);
      }

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
        origin: { y: 0.6 },
      });
      // Add a few more bursts for extra effect
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
        });
      }, 200);
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
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
  }, [hasWon, tempo, timeSignature, selectedNoteType]);

  return (
    <div className="flex flex-col items-center gap-8 p-8 rounded-lg border bg-card text-card-foreground shadow-sm w-[400px]">
      <div className="w-full flex justify-end mb-2">
        {(hasFlashSupport || hasVibrationSupport) && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Settings</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                {hasFlashSupport && (
                  <div className="flex items-center justify-between py-2">
                    <label className="text-sm font-medium">Flash on Beat</label>
                    <Switch 
                      checked={useFlash} 
                      onCheckedChange={(checked) => {
                        setUseFlash(checked);
                        if (!checked) {
                          // Clean up flash when disabled
                          if (trackRef.current) {
                            trackRef.current.stop();
                          }
                          if (mediaStreamRef.current) {
                            mediaStreamRef.current.getTracks().forEach(track => track.stop());
                          }
                          mediaStreamRef.current = null;
                          trackRef.current = null;
                          setHasFlashSupport(false);
                        }
                      }} 
                    />
                  </div>
                )}
                {hasVibrationSupport && (
                  <div className="flex items-center justify-between py-2">
                    <label className="text-sm font-medium">Vibrate on Beat</label>
                    <Switch 
                      checked={useVibration} 
                      onCheckedChange={(checked) => {
                        console.log('Vibration toggle:', { checked });
                        setUseVibration(checked);
                      }}
                    />
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <div className="flex flex-col items-center gap-1 -mt-4">
        <div className="h-[6rem] flex items-center justify-center relative">
          {showVictoryBanner && (
            <div
              className="absolute top-0 left-0 right-0 -translate-y-full bg-green-500 text-white py-2 px-4 rounded-t-lg text-center font-bold animate-bounce"
              style={{
                animation: "bounce 0.5s infinite",
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
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            {timeSignature.value !== "none" && (
              <>
                <button
                  onClick={() => {
                    const availableTypes = getAvailableNoteTypes(timeSignature);
                    const currentIndex = availableTypes.indexOf(selectedNoteType);
                    const nextIndex = (currentIndex + 1) % availableTypes.length;
                    setSelectedNoteType(availableTypes[nextIndex]);
                  }}
                  className={`hover:opacity-80 transition-opacity relative ${
                    getAvailableNoteTypes(timeSignature).length > 1
                      ? "cursor-pointer before:content-[attr(data-tooltip)] before:absolute before:px-2 before:py-1 before:left-1/2 before:-translate-x-1/2 before:translate-y-[-130%] before:top-0 before:bg-black/75 before:text-white before:text-xs before:rounded-md before:opacity-0 before:transition-opacity hover:before:opacity-100 before:whitespace-nowrap before:z-50"
                      : "cursor-default"
                  }`}
                  data-tooltip={
                    getAvailableNoteTypes(timeSignature).length > 1
                      ? `Change beat: ${getAvailableNoteTypes(timeSignature)
                          .map((type) => {
                            switch (type) {
                              case "quarter":
                                return "♩";
                              case "dottedQuarter":
                                return "♩.";
                              case "eighth":
                                return "♪";
                              default:
                                return type;
                            }
                          })
                          .join(" → ")}`
                      : undefined
                  }
                  style={{
                    cursor: getAvailableNoteTypes(timeSignature).length > 1 ? "pointer" : "default"
                  }}
                >
                  {selectedNoteType === "dottedQuarter" && getNoteSVG(6, tempo)}
                  {selectedNoteType === "eighth" && getNoteSVG(8, tempo)}
                  {selectedNoteType === "quarter" && getNoteSVG(4, tempo)}
                </button>
                <span>=</span>
              </>
            )}
            {getDisplayTempo(tempo, selectedNoteType, timeSignature)} BPM
          </div>
        </div>
      </div>

      <div className="w-full max-w-xs space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium">Tempo</label>
          <Button
            variant="outline"
            size="sm"
            onMouseDown={handleTapTempo}
            // onTouchStart={handleTapTempo}
            className="px-4"
          >
            Tap
          </Button>
        </div>
        <Slider
          value={[Math.min(tempo, 280)]}
          onValueChange={(values: number[]) => setTempo(values[0])}
          onValueCommit={() => {
            if (isPlaying) {
              startMetronome();
            }
          }}
          min={40}
          max={280}
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
          value={
            timeSignature.value === "none"
              ? "None"
              : `${timeSignature.beats}/${timeSignature.value}`
          }
          onValueChange={(value: string) => {
            const newTimeSignature =
              value === "None"
                ? { beats: 1, value: "none" as const }
                : (() => {
                    const [beats, noteValue] = value.split("/");
                    return {
                      beats: parseInt(beats),
                      value: noteValue as "4" | "8",
                    };
                  })();

            setTimeSignature(newTimeSignature);

            // Set default note type based on time signature denominator
            if (newTimeSignature.value === "8") {
              setSelectedNoteType("eighth");
            } else {
              setSelectedNoteType("quarter"); // For "4" and "none"
            }
            
            // Set accents based on the new time signature
            if (newTimeSignature.value === "none") {
              setAccentBeats([false]); // No accent for single beat mode
            } else {
              const newAccents = new Array(newTimeSignature.beats).fill(false);
              newAccents[0] = true; // First beat is accented by default
              setAccentBeats(newAccents);
            }

            if (isPlaying) {
              // Stop the current interval
              if (timerRef.current) {
                clearInterval(timerRef.current);
              }

              const intervalMs = (60 / tempoRef.current) * 1000;

              // Reset beat counter
              nextBeatRef.current = 0;
              setCurrentBeat(0);

              // Start the new interval
              timerRef.current = window.setInterval(() => {
                playClick(nextBeatRef.current);
                setCurrentBeat(nextBeatRef.current);
                nextBeatRef.current =
                  (nextBeatRef.current + 1) % newTimeSignature.beats;
              }, intervalMs);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select time signature" />
          </SelectTrigger>
          <SelectContent>
            {TIME_SIGNATURES.map((sig) => (
              <SelectItem key={sig.display} value={sig.display}>
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
          // variant={isPlaying ? "destructive" : "default"}
        >
          {isPlaying ? "Stop" : "Start"}
        </Button>
      </div>

      <div className="flex gap-2 items-center">
        {Array.from({ length: timeSignature.beats }).map((_, i) => (
          <button
            key={i}
            onClick={() => {
              setAccentBeats((prev) => {
                const newAccents = [...prev];
                newAccents[i] = !newAccents[i];
                return newAccents;
              });
            }}
            data-tooltip={
              accentBeats[i] ? "Remove accent" : "Add accent"
            }
            className={`group relative transition-all duration-200 rounded-full ${
              currentBeat === i ? "bg-primary" : "bg-muted"
            } ${
              accentBeats[i] ? "w-6 h-6" : "w-4 h-4"
            } hover:opacity-80 cursor-pointer before:content-[attr(data-tooltip)] before:absolute before:px-2 before:py-1 before:left-1/2 before:-translate-x-1/2 before:translate-y-[-130%] before:top-0 before:bg-black/75 before:text-white before:text-xs before:rounded-md before:opacity-0 before:transition-opacity hover:before:opacity-100 before:whitespace-nowrap`}
          />
        ))}
      </div>
    </div>
  );
}

function getNoteSVG(notevalue: number, tempo: number) {
  let thisEl: ReactElement = <></>;

  // Calculate size based on tempo
  const baseWidth = 40;
  const baseHeight = 50;
  const scale = tempo <= 280 ? 1 : 1 + ((tempo - 280) / (550 - 280)) * 0.33; // 33% larger at max
  const width = baseWidth * scale;
  const height = baseHeight * scale;

  // Get color based on tempo
  const color = getTempoColor(tempo);

  const note8th: ReactElement = (
    <svg width={width} height={height} viewBox="35 0 35 100">
      <path
        fill={color}
        d="M68.893,19.699C62.391,13.182,54.725,7.615,53.008,1.76v70.604c-4.908-6.32-13.438-6.596-20.097-3.447  c-7.548,3.572-13.24,11.873-8.896,20.975c4.303,9.103,14.292,9.963,21.876,6.394c5.892-2.802,10.658-8.478,10.394-15.179V24.743  c9.418,1.418,19.152,11.146,20.777,23.073C78.682,34.936,75.66,26.582,68.893,19.699z"
      />
    </svg>
  );

  const note4: ReactElement = (
    <svg width={width} height={height} viewBox="40 0 20.0 100">
      <path
        fill={color}
        d="M63.576,2.553v68.904c-2.951-3.758-7.191-5.355-11.549-5.355c-2.909,0-5.869,0.713-8.53,1.972  c-7.562,3.579-13.265,11.895-8.912,21.012c2.802,5.926,8.009,8.363,13.397,8.363c2.9,0,5.858-0.707,8.518-1.959  c5.727-2.726,10.389-8.158,10.418-14.607h0.006V2.553H63.576z"
      />
    </svg>
  );
  const note6: ReactElement = (
    <svg width={width} height={height} viewBox="35 0 35 100">
      <path
        fill={color}
        d="M55.809,2.552v68.904c-2.951-3.758-7.191-5.354-11.549-5.354c-2.909,0-5.869,0.713-8.53,1.971  c-7.562,3.58-13.265,11.895-8.912,21.012c2.802,5.926,8.009,8.363,13.397,8.363c2.9,0,5.858-0.707,8.518-1.959  c5.727-2.725,10.389-8.158,10.418-14.607h0.006V2.553L55.809,2.552L55.809,2.552z"
      />
      <circle cx="71.135" cy="88.035" r="3.557" />
    </svg>
  );

  switch (notevalue) {
    case 8:
      thisEl = note8th;
      break;
    case 6:
      thisEl = note6;
      break;
    case 4:
      thisEl = note4;
      break;
    default:
      thisEl = note4;
      break;
  }
  return thisEl;
}
