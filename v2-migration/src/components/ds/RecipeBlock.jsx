"use client";
import { useToolRecipe } from '@/lib/recipe/ToolRecipeContext';
export default function RecipeBlock({id,hidden=false,children,...props}) {
  const recipe=useToolRecipe();
  return <section {...props} id={id} hidden={hidden || recipe?.hidden.includes(id)}>{children}</section>;
}
