'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

interface DesignV2ContextState {
    isV2: boolean
    toggleV2: () => void
}

const DesignV2Context = createContext<DesignV2ContextState>({ isV2: false, toggleV2: () => { } })

export function DesignV2Provider({ children }: { children: React.ReactNode }) {
    const [isV2, setIsV2] = useState(false)

    // Initialize from localStorage
    useEffect(() => {
        const stored = localStorage.getItem('design-v2')
        if (stored === 'true') {
            setIsV2(true)
            document.documentElement.classList.add('design-v2')
        }
    }, [])

    const toggleV2 = () => {
        setIsV2(prev => {
            const next = !prev
            if (next) {
                localStorage.setItem('design-v2', 'true')
                document.documentElement.classList.add('design-v2')
            } else {
                localStorage.setItem('design-v2', 'false')
                document.documentElement.classList.remove('design-v2')
            }
            return next
        })
    }

    return (
        <DesignV2Context.Provider value={{ isV2, toggleV2 }}>
            {children}
        </DesignV2Context.Provider>
    )
}

export function useDesignV2() {
    return useContext(DesignV2Context)
}
