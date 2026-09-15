import React from "react";
import styled, { keyframes } from "styled-components";
import logo from "../../assets/criczone_full_logo.png";

// Full-screen branded transition (a broadcast "stinger") shown briefly when the
// TV switches: live match → summary → next match. Fades a dark curtain in with
// the CricZone logo revealing + a light sweep, then fades out to the new board.
const TransitionCurtain = () => (
  <Curtain>
    <Halo />
    <LogoWrap>
      <LogoImg src={logo} alt="CricZone" />
      <Sweep />
    </LogoWrap>
  </Curtain>
);

const curtain = keyframes`
  0% { opacity: 0; }
  12% { opacity: 1; }
  82% { opacity: 1; }
  100% { opacity: 0; }
`;
const reveal = keyframes`
  0% { opacity: 0; transform: scale(.72); filter: blur(6px); }
  22% { opacity: 1; transform: scale(1); filter: blur(0); }
  74% { opacity: 1; transform: scale(1.02); }
  100% { opacity: 0; transform: scale(1.08); filter: blur(2px); }
`;
const sweep = keyframes`
  0% { left: -60%; }
  55% { left: -60%; }
  100% { left: 160%; }
`;
const halo = keyframes`
  0%,100% { opacity: .25; transform: scale(1); }
  50% { opacity: .55; transform: scale(1.12); }
`;

const Curtain = styled.div`
  position: fixed; inset: 0; z-index: 9999;
  display: flex; align-items: center; justify-content: center; overflow: hidden;
  background: radial-gradient(900px 900px at 50% 50%, #1e293b 0%, #0b1120 62%, #070b16 100%);
  animation: ${curtain} 1.4s ease forwards;
`;
const Halo = styled.div`
  position: absolute; width: 60vh; height: 60vh; border-radius: 50%;
  background: radial-gradient(circle, rgba(96,165,250,.35), rgba(96,165,250,0) 62%);
  animation: ${halo} 1.4s ease-in-out both;
`;
const LogoWrap = styled.div`position: relative; display: inline-block; animation: ${reveal} 1.4s cubic-bezier(.2,.8,.2,1) both;`;
const LogoImg = styled.img`height: clamp(120px, 40vh, 460px); width: auto; object-fit: contain; display: block;`;
const Sweep = styled.div`
  position: absolute; top: 0; bottom: 0; width: 40%;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,.35), transparent);
  transform: skewX(-18deg); animation: ${sweep} 1.4s ease-in-out both; pointer-events: none;
`;

export default TransitionCurtain;
