import React from 'react';
import { FiBell, FiFileText, FiLock, FiMapPin, FiSend, FiShield, FiTag } from 'react-icons/fi';

interface LightPrivacyCollageProps {
  staticMode?: boolean;
}

/** Decorative light-mode canvas. It contains no page data and never leaves the UI. */
export function LightPrivacyCollage({ staticMode = false }: LightPrivacyCollageProps) {
  const motionClass = staticMode ? 'privacy-collage--static' : '';

  return (
    <div className={`privacy-collage ${motionClass}`} aria-hidden="true">
      <span className="privacy-collage__dot privacy-collage__dot--one" />
      <span className="privacy-collage__dot privacy-collage__dot--two" />
      <span className="privacy-collage__dot privacy-collage__dot--three" />

      <div className="privacy-sticker privacy-sticker--note privacy-sticker--top-left">
        <FiFileText />
        <span>PRIVATE</span>
      </div>
      <div className="privacy-sticker privacy-sticker--stamp privacy-sticker--top-right">
        <FiShield />
        <span>SAFE</span>
      </div>
      <div className="privacy-sticker privacy-sticker--ticket privacy-sticker--left">
        <FiTag />
        <span>MASKED</span>
      </div>
      <div className="privacy-sticker privacy-sticker--bell privacy-sticker--right">
        <FiBell />
      </div>
      <div className="privacy-sticker privacy-sticker--plane privacy-sticker--bottom-left">
        <FiSend />
        <span>LOCAL</span>
      </div>
      <div className="privacy-sticker privacy-sticker--tag privacy-sticker--bottom-right">
        <FiMapPin />
        <span>ON DEVICE</span>
      </div>
      <div className="privacy-sticker privacy-sticker--lock privacy-sticker--center">
        <FiLock />
      </div>
    </div>
  );
}

export default LightPrivacyCollage;
