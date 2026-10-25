import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Reuses the existing six cases; this opt-in run adds exact old/new renderer
// comparisons inside each camera capture without increasing the CI case count.
export default defineConfig(base,{
  testMatch:'rally-effects.spec.ts',
  reporter:[['list'],['json',{outputFile:'docs/verification/rally-4000/logs/single-pass-browser-pixels.json'}]],
  outputDir:'docs/verification/rally-4000/failures/single-pass-browser-attempt',
});
