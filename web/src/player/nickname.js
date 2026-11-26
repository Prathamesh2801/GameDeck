import { useState } from "react";

// The player's nickname, remembered per deck on this device.
export function useNickname(code) {
  const key = `gamedeck:nickname:${String(code).toUpperCase()}`;
  const [nickname, setState] = useState(() => localStorage.getItem(key));
  const setNickname = (value) => {
    localStorage.setItem(key, value);
    setState(value);
  };
  return [nickname, setNickname];
}
