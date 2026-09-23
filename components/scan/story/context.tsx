import React, {createContext, useContext} from 'react';
import type {StoryEdition} from './types';
export const StoryContext=createContext<StoryEdition|null>(null);
export function useStory(){const value=useContext(StoryContext);if(!value)throw new Error('A reviewed scan story is required');return value;}
