import { GiWatermelon, GiPhotoCamera, GiRunningShoe, GiPathDistance, GiBowlingStrike } from "react-icons/gi";

// Display info for each game slug (the server owns names and max scores).
export const GAME_META = {
  "slice-frenzy": { icon: GiWatermelon, blurb: "Swipe to slice fruit, dodge the bombs." },
  "picture-perfect": { icon: GiPhotoCamera, blurb: "Picture quiz about Zeal experiences." },
  "lane-dash": { icon: GiRunningShoe, blurb: "Endless lane runner: dodge, jump, collect." },
  "zip-to-victory": { icon: GiPathDistance, blurb: "Connect the numbers, fill every square." },
  "strike-alley": { icon: GiBowlingStrike, blurb: "Five-frame bowling. Aim, power, strike." },
};

export const gameIcon = (slug) => GAME_META[slug]?.icon ?? GiPathDistance;
