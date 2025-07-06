/**
 * This module contains all the code needed to start the application.  Loading
 * required modules and configure logging
 */

// This is needed for @fp8/simple-config to work correctly
import 'reflect-metadata';

// Configure logger and output destination
import { LogLevel, SimpleTextDestination } from 'jlog-facade';
SimpleTextDestination.use(LogLevel.OFF);

// Load the config and export ConfigStore and ConfigData
import { createConfigStore } from './core/config';

export const CONFIG_STORE = createConfigStore();
export const CONFIG_DATA = CONFIG_STORE.data;
