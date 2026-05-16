import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

export default function ExitModal({ onCancel, onConfirm }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
            style={{ background: 'rgba(0,0,0,0.9)', zIndex: 5000 }} // Increased z-index to ensure it covers everything
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-dark p-4 rounded-4 border border-secondary text-center shadow-lg mx-3"
                style={{ maxWidth: '320px' }}
            >
                <div className="d-inline-block p-3 bg-warning bg-opacity-10 rounded-circle mb-3">
                    <AlertTriangle size={40} className="text-warning" />
                </div>

                <h5 className="text-white fw-bold mb-2">Quit Game?</h5>
                <p className="text-secondary small mb-4">
                    Your current progress will be lost. Are you sure you want to leave the match?
                </p>

                <div className="d-flex flex-column gap-2">
                    <button
                        className="btn btn-danger py-2 fw-bold rounded-pill"
                        onClick={onConfirm}
                    >
                        Yes, Quit Game
                    </button>
                    <button
                        className="btn btn-outline-light py-2 fw-bold rounded-pill"
                        onClick={onCancel}
                    >
                        No, Stay Here
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}