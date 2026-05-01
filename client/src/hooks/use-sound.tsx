import { useEffect, useRef, useState } from "react";

type SoundOptions = {
  volume?: number;
  loop?: boolean;
  autoplay?: boolean;
};

const defaultOptions: SoundOptions = {
  volume: 0.5,
  loop: false,
  autoplay: false,
};

type SoundEffects = {
  [key: string]: string;
};



const SOUND_EFFECTS: SoundEffects = {
  
  win: "https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3", 
  lose: "https://assets.mixkit.co/active_storage/sfx/2001/2001-preview.mp3",
  click: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
  
  
  slotSpin: "https://assets.mixkit.co/active_storage/sfx/2017/2017-preview.mp3",
  slotStop: "https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3",
  slotLineWin: "https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3", 
  slotJackpot: "https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3",
  slotCoin: "https://assets.mixkit.co/active_storage/sfx/2073/2073-preview.mp3",
  
  
  diceRoll: "https://assets.mixkit.co/active_storage/sfx/2007/2007-preview.mp3",
  diceHit: "https://assets.mixkit.co/active_storage/sfx/2008/2008-preview.mp3",
  
  
  cashout: "https://assets.mixkit.co/active_storage/sfx/2002/2002-preview.mp3",
  crash: "https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3",
  
  
  cardDeal: "https://assets.mixkit.co/active_storage/sfx/2004/2004-preview.mp3",
  cardFlip: "https://assets.mixkit.co/active_storage/sfx/2005/2005-preview.mp3",
  cardShuffle: "https://assets.mixkit.co/active_storage/sfx/2006/2006-preview.mp3",
  
  
  rouletteStart: "https://assets.mixkit.co/active_storage/sfx/2009/2009-preview.mp3",
  rouletteEnd: "https://assets.mixkit.co/active_storage/sfx/2010/2010-preview.mp3",
  ballDrop: "https://assets.mixkit.co/active_storage/sfx/2011/2011-preview.mp3",
  
  
  buttonClick: "https://assets.mixkit.co/active_storage/sfx/2680/2680-preview.mp3",
  buttonHover: "https://assets.mixkit.co/active_storage/sfx/2682/2682-preview.mp3",
  notification: "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
};

export function useSound() {
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const [isEnabled, setIsEnabled] = useState<boolean>(true);

  useEffect(() => {
    
    Object.entries(SOUND_EFFECTS).forEach(([key, url]) => {
      const audio = new Audio();
      audio.src = url;
      audio.preload = "auto";
      audioRefs.current[key] = audio;
    });

    
    return () => {
      Object.values(audioRefs.current).forEach((audio) => {
        audio.pause();
        audio.src = "";
      });
    };
  }, []);

  const play = (soundName: string, options?: SoundOptions) => {
    if (!isEnabled) return;

    const audio = audioRefs.current[soundName];
    if (!audio) {
      console.warn(`Sound "${soundName}" not found`);
      return;
    }

    const { volume, loop } = { ...defaultOptions, ...options };

    try {
      
      audio.currentTime = 0;
      audio.volume = volume || 0.5;
      audio.loop = loop || false;
      
      
      const playPromise = audio.play();
      
      
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn(`Sound play error (${soundName}):`, error.message);
          
          
          
          
        });
      }
    } catch (err) {
      
      console.warn(`Sound system error:`, err);
    }
  };

  const stop = (soundName: string) => {
    const audio = audioRefs.current[soundName];
    if (!audio) return;
    
    audio.pause();
    audio.currentTime = 0;
  };

  const toggleSound = () => {
    setIsEnabled((prev) => !prev);
    
    
    if (isEnabled) {
      Object.values(audioRefs.current).forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
    }
  };

  return { play, stop, isEnabled, toggleSound };
}
