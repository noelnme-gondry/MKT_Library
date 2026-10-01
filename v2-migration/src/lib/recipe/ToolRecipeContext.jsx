"use client";
import { createContext, useContext } from 'react';
export const ToolRecipeContext=createContext(null);
export const useToolRecipe=()=>useContext(ToolRecipeContext);
