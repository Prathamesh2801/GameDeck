import { motion } from "framer-motion";
import { MdExplore } from "react-icons/md";
import logoImg from "@brand/zeal-logo.png";

export default function Header() {
  return (
    <motion.header
      className="my-6 md:my-8 text-center px-4"
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <motion.img
        src={logoImg}
        alt="Zeal Interactive"
        className="w-16 h-16 md:w-20 md:h-20  mx-auto drop-shadow-lg"
        animate={{ rotate: [0, 10, -10, 0] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }}
      />
      <h1 className="font-display font-bold text-xl sm:text-2xl md:text-4xl tracking-[0.2rem] md:tracking-[0.4rem] uppercase gradient-text m-0 mt-1">
        Picture Perfect
      </h1>
      <motion.div
        className="flex items-center justify-center gap-1.5 mt-1.5 text-brand-text-dim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <MdExplore className="text-brand-pink text-sm" />
        <span className="font-display text-xs uppercase tracking-widest">
          A Zeal Interactive Game
        </span>
        <MdExplore className="text-brand-pink text-sm" />
      </motion.div>
    </motion.header>
  );
}
