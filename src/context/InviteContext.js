// src/context/InviteContext.js
import React, { createContext, useContext } from 'react';

const InviteContext = createContext(null);

export const InviteProvider = ({ resetInviteFlags, children }) => {
  return (
    <InviteContext.Provider value={{ resetInviteFlags }}>
      {children}
    </InviteContext.Provider>
  );
};

export const useInvite = () => {
  const context = useContext(InviteContext);
  if (!context) {
    throw new Error('useInvite must be used within InviteProvider');
  }
  return context;
};