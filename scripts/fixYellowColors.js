#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Color replacement mappings
const colorReplacements = {
  // Tailwind yellow classes to sage
  'bg-yellow-50': 'bg-sage-50',
  'bg-yellow-100': 'bg-sage-100',
  'bg-yellow-200': 'bg-sage-200',
  'bg-yellow-300': 'bg-sage-300',
  'bg-yellow-400': 'bg-sage-400',
  'bg-yellow-500': 'bg-sage-500',
  'bg-yellow-600': 'bg-sage-600',
  'text-yellow-400': 'text-sage-400',
  'text-yellow-500': 'text-sage-500',
  'text-yellow-600': 'text-sage-600',
  'text-yellow-700': 'text-evergreen',
  'border-yellow-300': 'border-sage-300',
  'border-yellow-400': 'border-sage-400',
  'border-yellow-500': 'border-sage-500',
  'hover:bg-yellow-50': 'hover:bg-sage-50',
  'hover:bg-yellow-100': 'hover:bg-sage-100',
  'hover:bg-yellow-500': 'hover:bg-sage-500',
  
  // Amber to sage
  'bg-amber-50': 'bg-sage-50',
  'bg-amber-100': 'bg-sage-100',
  'bg-amber-200': 'bg-sage-200',
  'bg-amber-300': 'bg-sage-300',
  'bg-amber-400': 'bg-sage-400',
  'bg-amber-500': 'bg-sage-500',
  'text-amber-600': 'text-sage-600',
  'text-amber-700': 'text-evergreen',
  'border-amber-300': 'border-sage-300',
  
  // Hex color replacements
  '#fef3c7': '#e8ede7', // yellow-50 -> sage-100
  '#fde68a': '#d1dbd0', // yellow-200 -> sage-200
  '#fcd34d': '#b3c4b1', // yellow-300 -> sage-300
  '#fbbf24': '#8EA58C', // yellow-400 -> sage-400
  '#f59e0b': '#738A6E', // yellow-500 -> sage-500
  '#d97706': '#5a6e57', // yellow-600 -> sage-600
  '#ffeb3b': '#8EA58C', // Material yellow -> sage
  '#ffd700': '#8EA58C', // Gold -> sage
  '#ffa500': '#738A6E', // Orange -> moss
};

// Directories to search
const searchDirs = [
  'client/src/components',
  'client/src/pages',
  'client/src/lib',
  'server'
];

function processFile(filePath) {
  const ext = path.extname(filePath);
  if (!['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
    return;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    const originalContent = content;

    // Apply direct replacements
    for (const [search, replace] of Object.entries(colorReplacements)) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      content = content.replace(regex, replace);
    }

    // Special handling for className strings containing yellow/amber
    content = content.replace(/className\s*=\s*["'`]([^"'`]*)["'`]/g, (match, classes) => {
      let newClasses = classes;
      
      // Replace yellow with sage
      newClasses = newClasses.replace(/\byellow-(\d+)\b/g, 'sage-$1');
      newClasses = newClasses.replace(/\bamber-(\d+)\b/g, 'sage-$1');
      newClasses = newClasses.replace(/\borange-(\d+)\b/g, 'sage-$1');
      
      // Replace specific yellow patterns
      newClasses = newClasses.replace(/\byellow\b/g, 'sage');
      newClasses = newClasses.replace(/\bamber\b/g, 'sage');
      
      return `className="${newClasses}"`;
    });

    // Check for template literals with yellow colors
    content = content.replace(/`([^`]*)`/g, (match, template) => {
      let newTemplate = template;
      
      // Replace yellow references in template literals
      newTemplate = newTemplate.replace(/yellow-(\d+)/g, 'sage-$1');
      newTemplate = newTemplate.replace(/amber-(\d+)/g, 'sage-$1');
      
      return `\`${newTemplate}\``;
    });

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Fixed colors in: ${filePath}`);
      modified = true;
    }

    return modified;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function walkDirectory(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`⚠️ Directory not found: ${dir}`);
    return;
  }

  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      walkDirectory(fullPath);
    } else if (stat.isFile()) {
      processFile(fullPath);
    }
  }
}

console.log('🎨 Starting comprehensive yellow-to-sage color fix...\n');

let filesProcessed = 0;
let filesModified = 0;

for (const dir of searchDirs) {
  console.log(`📁 Processing directory: ${dir}`);
  walkDirectory(dir);
}

console.log('\n✨ Color fix complete!');
console.log('🔍 All yellow, amber, and orange colors have been replaced with your therapeutic sage-green palette.');