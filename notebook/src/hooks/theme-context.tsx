import {useState, createContext, ReactNode} from 'react';

export type ThemeContextT = {
    background: {
        gray: string,
        white: string,
        black: string
    },
    boarder: {
        gray: string,
        white: string
    },
    text: {
        gray1: string,
        gray2: string,
        white: string,
        black: string,
    }
    red: string,
    orange: string,
    blue: string,
    gray: string,
    primary: string,
    setIsDark: (isDark: boolean) => void
}

const lightModeColorSet = {
    background:{gray: '#f0f0f0', white: '#ffffff', black: '#434343'},
    boarder: {gray: '#bfbfbf', white: '#ffffff'},
    text: {gray1: '#8c8c8c', gray2: '', white: '#ffffff', black: '#000000'},
    red: '#ff4d4f',
    orange: '#faad14',
    blue: "#85a5ff",
    gray: "bfbfbf",
    primary: '#1890ff',
}

export const ThemeContext = createContext<ThemeContextT>({...lightModeColorSet, setIsDark: (isDark: boolean) => {}});

export default function ThemeProvider({children}: {children: ReactNode}) {
    const [isDark, setIsDark] = useState(false)
    const [colorSet, setColorSet] = useState(lightModeColorSet)

    return (
        <ThemeContext.Provider value={{...colorSet, setIsDark}}>
        {children}
        </ThemeContext.Provider>
    )
}
