import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";

export const AnimatedNavLink = ({ to, label, className, children }) => {
  return (
    <NavLink to={to} className={({ isActive }) => `${className} ${isActive ? "active" : ""}`}>
      {({ isActive }) => (
        <div className="relative flex items-center justify-center">
          <span className="relative z-10">{label}</span>
          {isActive && (
            <motion.div
              layoutId="active-pill"
              className="absolute inset-0 z-0 rounded-full bg-primary/10"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          )}
          {children}
        </div>
      )}
    </NavLink>
  );
};