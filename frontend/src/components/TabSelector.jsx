import { useId } from 'react';
import { motion, MotionConfig } from 'motion/react';

export default function TabSelector({ options, value, onChange, label, style }) {
  const groupId = useId();

  return (
    <MotionConfig reducedMotion="user">
      <div className="period-selector" role="group" aria-label={label} style={style}>
        {options.map((o) => {
          const activo = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              className={`period-btn tab-sel ${activo ? 'active' : ''}`}
              aria-pressed={activo}
              onClick={() => onChange(o.id)}
            >
              {activo && (
                <motion.span
                  layoutId={`${groupId}-indicador`}
                  // Solo re-mide/anima cuando cambia la opción activa. Sin esto,
                  // cualquier desplazamiento del layout (expandir/colapsar filas,
                  // cambios de altura) dispara la animación desde la posición vieja.
                  layoutDependency={value}
                  className="tab-sel-indicator"
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                />
              )}
              <span className="tab-sel-label">{o.label}</span>
            </button>
          );
        })}
      </div>
    </MotionConfig>
  );
}
