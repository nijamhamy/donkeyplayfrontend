import React from 'react';
import { User, Cpu } from 'lucide-react'; // Icons-க்காக

const PlayerSlot = ({ pos, name, count, isTurn, isWinner }) => {
  const styles = {
    p1: 'bottom-0 start-50 translate-middle-x mb-2',
    p2: 'top-50 start-0 translate-middle-y ms-3',
    p3: 'top-0 start-50 translate-middle-x mt-3',
    p4: 'top-50 end-0 translate-middle-y me-3'
  };

  return (
    <div className={`position-absolute ${styles[pos]} text-center z-3`}>
      <div className={`p-2 rounded-3 border-2 shadow ${isTurn ? 'border-warning bg-success' : 'border-secondary bg-dark'} text-white`}>
        <div className="d-flex align-items-center gap-2 px-2">
          {pos === 'p1' ? <User size={20} className="text-info" /> : <Cpu size={20} className="text-danger" />}
          <span className="fw-bold small">{name}</span>
        </div>
        <div className="mt-1 small opacity-75">
          {isWinner ? '✅ FINISHED' : `Cards: ${count}`}
        </div>
      </div>
    </div>
  );
};

export default PlayerSlot;