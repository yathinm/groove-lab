'use client'

import { useEffect, useState } from 'react'

type AnimatedTitleProps = {
  texts?: string[]
  typeSpeed?: number
  deleteSpeed?: number
  pauseDuration?: number
  className?: string
}

export default function AnimatedTitle({
  texts = ['GROOVE LAB'],
  typeSpeed = 70,
  deleteSpeed = 45,
  pauseDuration = 1600,
  className = ''
}: AnimatedTitleProps) {
  const [displayText, setDisplayText] = useState('')
  const [isTyping, setIsTyping] = useState(true)
  const [currentTextIndex, setCurrentTextIndex] = useState(0)
  const [currentCharIndex, setCurrentCharIndex] = useState(0)
  const [isActivelyTyping, setIsActivelyTyping] = useState(false)

  useEffect(() => {
    if (isTyping) {
      if (currentCharIndex < texts[currentTextIndex].length) {
        setIsActivelyTyping(true)
        const t = setTimeout(() => {
          setDisplayText(texts[currentTextIndex].slice(0, currentCharIndex + 1))
          setCurrentCharIndex(currentCharIndex + 1)
        }, typeSpeed)
        return () => clearTimeout(t)
      } else {
        setIsActivelyTyping(false)
        const t = setTimeout(() => setIsTyping(false), pauseDuration)
        return () => clearTimeout(t)
      }
    } else {
      if (currentCharIndex > 0) {
        setIsActivelyTyping(true)
        const t = setTimeout(() => {
          setDisplayText(texts[currentTextIndex].slice(0, currentCharIndex - 1))
          setCurrentCharIndex(currentCharIndex - 1)
        }, deleteSpeed)
        return () => clearTimeout(t)
      } else {
        setIsActivelyTyping(false)
        const t = setTimeout(() => {
          setCurrentTextIndex((p) => (p + 1) % texts.length)
          setIsTyping(true)
        }, 1200)
        return () => clearTimeout(t)
      }
    }
  }, [currentCharIndex, isTyping, currentTextIndex, texts, typeSpeed, deleteSpeed, pauseDuration])

  return (
    <div className={`block whitespace-pre-line relative ${className}`}>
      <div className="absolute bottom-0 left-0 right-0">
        {displayText}
        <span className={`inline-block h-[1.1em] w-[0.08em] translate-y-[0.06em] bg-white/90 align-top ${isActivelyTyping ? '' : 'animate-pulse'}`}></span>
      </div>
    </div>
  )
}


