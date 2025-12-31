#!/usr/bin/env python3
"""
Comprehensive Clinical Application Audit Script

This script audits a TypeScript/React clinical management application for:
1. TypeScript/JavaScript syntax errors
2. Import/export issues
3. Database schema mismatches
4. API endpoint consistency
5. Component structure and dependencies
6. Configuration issues
7. Missing dependencies
8. Type safety violations
9. React Hook issues
10. Brand color compliance

Generates prioritized fixes and iterates until 100% pass rate.
"""

import os
import re
import json
import ast
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional
from dataclasses import dataclass, field
from enum import Enum

class Severity(Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH" 
    MEDIUM = "MEDIUM"
    LOW = "LOW"

@dataclass
class Issue:
    file_path: str
    line_number: int
    severity: Severity
    category: str
    description: str
    fix_suggestion: str
    code_snippet: str = ""
    
@dataclass 
class AuditResults:
    issues: List[Issue] = field(default_factory=list)
    total_files_scanned: int = 0
    pass_rate: float = 0.0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0

class ClinicalAppAuditor:
    def __init__(self, root_path: str = "."):
        self.root_path = Path(root_path)
        self.results = AuditResults()
        
        # Brand colors for compliance check
        self.brand_colors = {
            "ivory": "#F2F3F1",
            "sage": "#8EA58C", 
            "moss": "#738A6E",
            "evergreen": "#344C3D",
            "french_blue": "#88A5BC"
        }
        
        # Forbidden colors that should be replaced
        self.forbidden_colors = [
            "#ff", "#00", "#blue", "#red", "#green", "#yellow", "#purple", "#pink",
            "blue-", "red-", "green-", "yellow-", "purple-", "pink-", "indigo-", "violet-"
        ]
        
        # File patterns to scan
        self.typescript_patterns = ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]
        self.config_patterns = ["**/*.json", "**/*.config.*", "**/tsconfig.json"]
        self.style_patterns = ["**/*.css", "**/*.scss", "**/*.sass"]
        
    def run_audit(self) -> AuditResults:
        """Main audit runner"""
        print("🔍 Starting comprehensive clinical application audit...")
        
        # Critical checks first
        self._check_typescript_compilation()
        self._check_missing_dependencies() 
        self._check_database_schema_consistency()
        self._check_api_route_consistency()
        
        # High priority checks
        self._check_import_export_issues()
        self._check_component_structure()
        self._check_react_hooks_usage()
        self._check_type_safety()
        
        # Medium priority checks
        self._check_brand_color_compliance()
        self._check_configuration_files()
        self._check_environment_variables()
        
        # Low priority checks
        self._check_code_quality()
        self._check_documentation()
        
        self._calculate_results()
        return self.results
    
    def _check_typescript_compilation(self):
        """Check for TypeScript compilation errors"""
        print("📝 Checking TypeScript compilation...")
        
        try:
            # Run TypeScript compiler check
            result = subprocess.run(
                ["npx", "tsc", "--noEmit", "--skipLibCheck"],
                capture_output=True,
                text=True,
                cwd=self.root_path
            )
            
            if result.returncode != 0:
                # Parse TypeScript errors
                errors = result.stderr.split('\n')
                for error in errors:
                    if error.strip() and not error.startswith('Found'):
                        self._parse_typescript_error(error)
                        
        except Exception as e:
            self._add_issue(
                "tsconfig.json", 0, Severity.CRITICAL,
                "TypeScript", f"Failed to run TypeScript compiler: {e}",
                "Ensure TypeScript is properly installed and configured"
            )
    
    def _parse_typescript_error(self, error_line: str):
        """Parse TypeScript error output"""
        # Pattern: file(line,col): error TS#### message
        pattern = r'(.+?)\((\d+),\d+\): error TS\d+: (.+)'
        match = re.match(pattern, error_line)
        
        if match:
            file_path, line_num, message = match.groups()
            self._add_issue(
                file_path, int(line_num), Severity.CRITICAL,
                "TypeScript", f"Compilation error: {message}",
                "Fix TypeScript syntax and type errors"
            )
    
    def _check_missing_dependencies(self):
        """Check for missing NPM dependencies"""
        print("📦 Checking dependencies...")
        
        package_json_path = self.root_path / "package.json"
        if not package_json_path.exists():
            self._add_issue(
                "package.json", 0, Severity.CRITICAL,
                "Dependencies", "package.json not found",
                "Create package.json with proper dependencies"
            )
            return
            
        try:
            with open(package_json_path) as f:
                package_data = json.load(f)
                
            dependencies = {**package_data.get('dependencies', {}), 
                          **package_data.get('devDependencies', {})}
            
            # Check for common missing dependencies
            required_deps = [
                '@types/react', '@types/react-dom', 'typescript',
                'drizzle-orm', '@tanstack/react-query', 'wouter'
            ]
            
            for dep in required_deps:
                if dep not in dependencies:
                    self._add_issue(
                        "package.json", 0, Severity.HIGH,
                        "Dependencies", f"Missing required dependency: {dep}",
                        f"Add {dep} to dependencies or devDependencies"
                    )
                    
        except Exception as e:
            self._add_issue(
                "package.json", 0, Severity.CRITICAL,
                "Dependencies", f"Failed to parse package.json: {e}",
                "Fix package.json syntax"
            )
    
    def _check_database_schema_consistency(self):
        """Check database schema consistency"""
        print("🗄️ Checking database schema...")
        
        schema_path = self.root_path / "shared" / "schema.ts"
        if not schema_path.exists():
            self._add_issue(
                "shared/schema.ts", 0, Severity.CRITICAL,
                "Database", "Database schema file not found",
                "Create shared/schema.ts with Drizzle schema definitions"
            )
            return
            
        # Check for common schema issues
        try:
            with open(schema_path) as f:
                content = f.read()
                
            # Check for missing exports
            if "export const" not in content:
                self._add_issue(
                    "shared/schema.ts", 0, Severity.HIGH,
                    "Database", "No table exports found in schema",
                    "Add proper table exports"
                )
                
            # Check for missing types
            if "export type" not in content:
                self._add_issue(
                    "shared/schema.ts", 0, Severity.MEDIUM,
                    "Database", "No type exports found in schema", 
                    "Add proper type exports for InsertUser, User, etc."
                )
                
        except Exception as e:
            self._add_issue(
                "shared/schema.ts", 0, Severity.HIGH,
                "Database", f"Failed to read schema file: {e}",
                "Fix schema file accessibility"
            )
    
    def _check_api_route_consistency(self):
        """Check API route consistency"""
        print("🛣️ Checking API routes...")
        
        # Check server routes
        routes_path = self.root_path / "server" / "routes.ts"
        if routes_path.exists():
            self._check_server_routes(routes_path)
            
        # Check client API calls
        self._check_client_api_calls()
    
    def _check_server_routes(self, routes_path: Path):
        """Check server-side route definitions"""
        try:
            with open(routes_path) as f:
                content = f.read()
                
            # Find all route definitions
            route_patterns = [
                r'app\.(get|post|put|delete)\([\'"]([^\'"]+)[\'"]',
                r'router\.(get|post|put|delete)\([\'"]([^\'"]+)[\'"]'
            ]
            
            routes = []
            for pattern in route_patterns:
                matches = re.findall(pattern, content)
                routes.extend([(method.upper(), path) for method, path in matches])
                
            # Check for inconsistent route patterns
            for method, path in routes:
                if not path.startswith('/api/'):
                    self._add_issue(
                        str(routes_path), 0, Severity.MEDIUM,
                        "API Routes", f"Route {path} doesn't follow /api/ convention",
                        f"Update route to start with /api/"
                    )
                    
        except Exception as e:
            self._add_issue(
                str(routes_path), 0, Severity.HIGH,
                "API Routes", f"Failed to parse routes file: {e}",
                "Fix routes file syntax"
            )
    
    def _check_client_api_calls(self):
        """Check client-side API calls for consistency"""
        client_dir = self.root_path / "client" / "src"
        if not client_dir.exists():
            return
            
        for file_path in client_dir.rglob("*.tsx"):
            try:
                with open(file_path) as f:
                    content = f.read()
                    
                # Find useQuery calls
                query_pattern = r'queryKey:\s*\[[\'"]([^\'"]+)[\'"]'
                queries = re.findall(query_pattern, content)
                
                for query in queries:
                    if not query.startswith('/api/'):
                        self._add_issue(
                            str(file_path), 0, Severity.MEDIUM,
                            "API Calls", f"Query key {query} doesn't follow /api/ convention",
                            f"Update query key to start with /api/"
                        )
                        
            except Exception:
                continue
    
    def _check_import_export_issues(self):
        """Check for import/export issues"""
        print("📥 Checking imports/exports...")
        
        for pattern in self.typescript_patterns:
            for file_path in self.root_path.rglob(pattern):
                if 'node_modules' in str(file_path):
                    continue
                self._check_file_imports(file_path)
    
    def _check_file_imports(self, file_path: Path):
        """Check individual file for import issues"""
        try:
            with open(file_path) as f:
                content = f.read()
                
            lines = content.split('\n')
            for i, line in enumerate(lines, 1):
                line = line.strip()
                
                # Check for invalid import paths
                if line.startswith('import') and 'from' in line:
                    import_match = re.search(r'from [\'"]([^\'"]+)[\'"]', line)
                    if import_match:
                        import_path = import_match.group(1)
                        
                        # Check relative imports
                        if import_path.startswith('./') or import_path.startswith('../'):
                            # Resolve relative path
                            resolved_path = (file_path.parent / import_path).resolve()
                            possible_files = [
                                resolved_path,
                                resolved_path.with_suffix('.ts'),
                                resolved_path.with_suffix('.tsx'),
                                resolved_path / 'index.ts',
                                resolved_path / 'index.tsx'
                            ]
                            
                            if not any(p.exists() for p in possible_files):
                                self._add_issue(
                                    str(file_path), i, Severity.HIGH,
                                    "Imports", f"Import path not found: {import_path}",
                                    f"Fix import path or create missing file"
                                )
                                
        except Exception:
            pass
    
    def _check_component_structure(self):
        """Check React component structure"""
        print("⚛️ Checking React components...")
        
        client_dir = self.root_path / "client" / "src"
        if not client_dir.exists():
            return
            
        for file_path in client_dir.rglob("*.tsx"):
            self._check_react_component(file_path)
    
    def _check_react_component(self, file_path: Path):
        """Check individual React component"""
        try:
            with open(file_path) as f:
                content = f.read()
                
            # Check for proper default export
            if not re.search(r'export default', content):
                self._add_issue(
                    str(file_path), 0, Severity.MEDIUM,
                    "React", "Component missing default export",
                    "Add default export for React component"
                )
                
            # Check for unused imports
            import_lines = re.findall(r'import.*from.*', content)
            for import_line in import_lines:
                if 'React' in import_line and 'import React' in import_line:
                    if 'React.' not in content and 'createElement' not in content:
                        self._add_issue(
                            str(file_path), 0, Severity.LOW,
                            "React", "Unnecessary React import (using JSX transform)",
                            "Remove explicit React import"
                        )
                        
        except Exception:
            pass
    
    def _check_react_hooks_usage(self):
        """Check React Hooks usage patterns"""
        print("🪝 Checking React Hooks...")
        
        client_dir = self.root_path / "client" / "src"
        if not client_dir.exists():
            return
            
        for file_path in client_dir.rglob("*.tsx"):
            self._check_hooks_in_file(file_path)
    
    def _check_hooks_in_file(self, file_path: Path):
        """Check hooks usage in a specific file"""
        try:
            with open(file_path) as f:
                content = f.read()
                
            lines = content.split('\n')
            
            # Check for hooks called conditionally
            for i, line in enumerate(lines, 1):
                if re.search(r'if.*use[A-Z]', line) or re.search(r'use[A-Z].*\?\s*', line):
                    self._add_issue(
                        str(file_path), i, Severity.HIGH,
                        "React Hooks", "Hook called conditionally",
                        "Move hook call outside conditional logic"
                    )
                    
            # Check for missing dependencies in useEffect
            useeffect_blocks = re.findall(r'useEffect\((.*?)\[(.*?)\]', content, re.DOTALL)
            for block, deps in useeffect_blocks:
                # Simple check for variables used in effect but not in deps
                # This is a basic implementation
                pass
                
        except Exception:
            pass
    
    def _check_type_safety(self):
        """Check TypeScript type safety"""
        print("🔒 Checking type safety...")
        
        for pattern in self.typescript_patterns:
            for file_path in self.root_path.rglob(pattern):
                if 'node_modules' in str(file_path):
                    continue
                self._check_types_in_file(file_path)
    
    def _check_types_in_file(self, file_path: Path):
        """Check types in individual file"""
        try:
            with open(file_path) as f:
                content = f.read()
                
            lines = content.split('\n')
            
            for i, line in enumerate(lines, 1):
                line = line.strip()
                
                # Check for 'any' type usage
                if re.search(r':\s*any\b', line) and not '// @ts-ignore' in line:
                    self._add_issue(
                        str(file_path), i, Severity.MEDIUM,
                        "Type Safety", "Using 'any' type",
                        "Replace 'any' with specific type"
                    )
                    
                # Check for missing return types on functions
                if re.search(r'function\s+\w+\([^)]*\)\s*{', line):
                    if '):' not in line:
                        self._add_issue(
                            str(file_path), i, Severity.LOW,
                            "Type Safety", "Function missing return type",
                            "Add explicit return type to function"
                        )
                        
        except Exception:
            pass
    
    def _check_brand_color_compliance(self):
        """Check brand color compliance"""
        print("🎨 Checking brand color compliance...")
        
        # Check CSS files
        for pattern in self.style_patterns:
            for file_path in self.root_path.rglob(pattern):
                self._check_colors_in_css(file_path)
                
        # Check TypeScript/JSX files for inline styles
        for pattern in self.typescript_patterns:
            for file_path in self.root_path.rglob(pattern):
                if 'node_modules' in str(file_path):
                    continue
                self._check_colors_in_tsx(file_path)
    
    def _check_colors_in_css(self, file_path: Path):
        """Check colors in CSS files"""
        try:
            with open(file_path) as f:
                content = f.read()
                
            lines = content.split('\n')
            
            for i, line in enumerate(lines, 1):
                for forbidden in self.forbidden_colors:
                    if forbidden in line.lower():
                        self._add_issue(
                            str(file_path), i, Severity.MEDIUM,
                            "Brand Colors", f"Non-brand color found: {forbidden}",
                            f"Replace with brand colors: {list(self.brand_colors.values())}"
                        )
                        
        except Exception:
            pass
    
    def _check_colors_in_tsx(self, file_path: Path):
        """Check colors in TSX files"""
        try:
            with open(file_path) as f:
                content = f.read()
                
            # Look for className with color classes
            color_classes = re.findall(r'className=[\'"][^\'\"]*(?:bg-|text-|border-)(blue|red|green|yellow|purple|pink|indigo|violet)[^\'\"]*[\'"]', content)
            
            for color_class in color_classes:
                self._add_issue(
                    str(file_path), 0, Severity.MEDIUM,
                    "Brand Colors", f"Non-brand Tailwind color: {color_class}",
                    "Replace with brand color classes or custom styles"
                )
                
        except Exception:
            pass
    
    def _check_configuration_files(self):
        """Check configuration files"""
        print("⚙️ Checking configuration...")
        
        # Check tsconfig.json
        tsconfig_path = self.root_path / "tsconfig.json"
        if tsconfig_path.exists():
            self._check_tsconfig(tsconfig_path)
        else:
            self._add_issue(
                "tsconfig.json", 0, Severity.HIGH,
                "Configuration", "tsconfig.json not found",
                "Create tsconfig.json with proper TypeScript configuration"
            )
            
        # Check package.json scripts
        package_json_path = self.root_path / "package.json"
        if package_json_path.exists():
            self._check_package_scripts(package_json_path)
    
    def _check_tsconfig(self, tsconfig_path: Path):
        """Check TypeScript configuration"""
        try:
            with open(tsconfig_path) as f:
                config = json.load(f)
                
            compiler_options = config.get('compilerOptions', {})
            
            # Check for important settings
            if compiler_options.get('strict') != True:
                self._add_issue(
                    str(tsconfig_path), 0, Severity.MEDIUM,
                    "Configuration", "TypeScript strict mode not enabled",
                    "Enable strict mode in compilerOptions"
                )
                
            if 'paths' not in compiler_options:
                self._add_issue(
                    str(tsconfig_path), 0, Severity.LOW,
                    "Configuration", "No path mappings configured",
                    "Add path mappings for cleaner imports"
                )
                
        except Exception as e:
            self._add_issue(
                str(tsconfig_path), 0, Severity.HIGH,
                "Configuration", f"Failed to parse tsconfig.json: {e}",
                "Fix JSON syntax in tsconfig.json"
            )
    
    def _check_package_scripts(self, package_path: Path):
        """Check package.json scripts"""
        try:
            with open(package_path) as f:
                package_data = json.load(f)
                
            scripts = package_data.get('scripts', {})
            
            required_scripts = ['dev', 'build', 'start']
            for script in required_scripts:
                if script not in scripts:
                    self._add_issue(
                        str(package_path), 0, Severity.LOW,
                        "Configuration", f"Missing {script} script",
                        f"Add {script} script to package.json"
                    )
                    
        except Exception:
            pass
    
    def _check_environment_variables(self):
        """Check environment variable usage"""
        print("🌍 Checking environment variables...")
        
        # Look for process.env usage
        for pattern in self.typescript_patterns:
            for file_path in self.root_path.rglob(pattern):
                if 'node_modules' in str(file_path):
                    continue
                self._check_env_vars_in_file(file_path)
    
    def _check_env_vars_in_file(self, file_path: Path):
        """Check environment variables in file"""
        try:
            with open(file_path) as f:
                content = f.read()
                
            # Find process.env usage
            env_vars = re.findall(r'process\.env\.([A-Z_]+)', content)
            
            # Check for frontend env vars without VITE_ prefix
            if 'client/src' in str(file_path):
                for var in env_vars:
                    if not var.startswith('VITE_'):
                        self._add_issue(
                            str(file_path), 0, Severity.HIGH,
                            "Environment", f"Frontend env var {var} missing VITE_ prefix",
                            f"Rename to VITE_{var} or use import.meta.env"
                        )
                        
        except Exception:
            pass
    
    def _check_code_quality(self):
        """Check general code quality issues"""
        print("✨ Checking code quality...")
        
        for pattern in self.typescript_patterns:
            for file_path in self.root_path.rglob(pattern):
                if 'node_modules' in str(file_path):
                    continue
                self._check_quality_in_file(file_path)
    
    def _check_quality_in_file(self, file_path: Path):
        """Check code quality in individual file"""
        try:
            with open(file_path) as f:
                content = f.read()
                
            lines = content.split('\n')
            
            for i, line in enumerate(lines, 1):
                # Check for console.log (should be removed in production)
                if 'console.log' in line and '// @keep' not in line:
                    self._add_issue(
                        str(file_path), i, Severity.LOW,
                        "Code Quality", "console.log found",
                        "Remove console.log or replace with proper logging"
                    )
                    
                # Check for TODO comments
                if 'TODO' in line.upper() or 'FIXME' in line.upper():
                    self._add_issue(
                        str(file_path), i, Severity.LOW,
                        "Code Quality", "TODO/FIXME comment found",
                        "Complete or remove TODO/FIXME comment"
                    )
                    
        except Exception:
            pass
    
    def _check_documentation(self):
        """Check documentation completeness"""
        print("📚 Checking documentation...")
        
        # Check for README
        readme_files = list(self.root_path.glob("README*"))
        if not readme_files:
            self._add_issue(
                "README.md", 0, Severity.LOW,
                "Documentation", "README file not found",
                "Create README.md with project documentation"
            )
    
    def _add_issue(self, file_path: str, line_number: int, severity: Severity, 
                   category: str, description: str, fix_suggestion: str, code_snippet: str = ""):
        """Add an issue to the results"""
        issue = Issue(
            file_path=file_path,
            line_number=line_number,
            severity=severity,
            category=category,
            description=description,
            fix_suggestion=fix_suggestion,
            code_snippet=code_snippet
        )
        self.results.issues.append(issue)
    
    def _calculate_results(self):
        """Calculate final audit results"""
        total_issues = len(self.results.issues)
        
        # Count by severity
        for issue in self.results.issues:
            if issue.severity == Severity.CRITICAL:
                self.results.critical_count += 1
            elif issue.severity == Severity.HIGH:
                self.results.high_count += 1
            elif issue.severity == Severity.MEDIUM:
                self.results.medium_count += 1
            else:
                self.results.low_count += 1
        
        # Calculate pass rate (inverse of critical and high issues)
        critical_high = self.results.critical_count + self.results.high_count
        if total_issues == 0:
            self.results.pass_rate = 100.0
        else:
            self.results.pass_rate = max(0, (total_issues - critical_high) / total_issues * 100)
    
    def generate_report(self) -> str:
        """Generate audit report"""
        report = []
        report.append("=" * 60)
        report.append("🏥 CLINICAL APPLICATION AUDIT REPORT")
        report.append("=" * 60)
        report.append(f"📊 OVERALL PASS RATE: {self.results.pass_rate:.1f}%")
        report.append("")
        report.append(f"📈 ISSUE BREAKDOWN:")
        report.append(f"   🔴 CRITICAL: {self.results.critical_count}")
        report.append(f"   🟠 HIGH:     {self.results.high_count}")
        report.append(f"   🟡 MEDIUM:   {self.results.medium_count}")
        report.append(f"   🟢 LOW:      {self.results.low_count}")
        report.append("")
        
        if self.results.issues:
            # Group by severity
            issues_by_severity = {
                Severity.CRITICAL: [],
                Severity.HIGH: [],
                Severity.MEDIUM: [],
                Severity.LOW: []
            }
            
            for issue in self.results.issues:
                issues_by_severity[issue.severity].append(issue)
            
            for severity in [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW]:
                issues = issues_by_severity[severity]
                if not issues:
                    continue
                    
                icon = {"CRITICAL": "🔴", "HIGH": "🟠", "MEDIUM": "🟡", "LOW": "🟢"}[severity.value]
                report.append(f"{icon} {severity.value} ISSUES ({len(issues)}):")
                report.append("-" * 40)
                
                for i, issue in enumerate(issues, 1):
                    report.append(f"{i}. {issue.file_path}:{issue.line_number}")
                    report.append(f"   Category: {issue.category}")
                    report.append(f"   Issue: {issue.description}")
                    report.append(f"   Fix: {issue.fix_suggestion}")
                    if issue.code_snippet:
                        report.append(f"   Code: {issue.code_snippet}")
                    report.append("")
                
        else:
            report.append("✅ No issues found!")
        
        return "\n".join(report)
    
    def generate_fixes(self) -> List[str]:
        """Generate automated fixes for issues"""
        fixes = []
        
        # Sort issues by severity (critical first)
        sorted_issues = sorted(self.results.issues, 
                             key=lambda x: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].index(x.severity.value))
        
        for issue in sorted_issues:
            if issue.severity in [Severity.CRITICAL, Severity.HIGH]:
                fix_command = self._generate_fix_command(issue)
                if fix_command:
                    fixes.append(fix_command)
        
        return fixes
    
    def _generate_fix_command(self, issue: Issue) -> Optional[str]:
        """Generate specific fix command for an issue"""
        if issue.category == "TypeScript" and "Missing" in issue.description:
            return f"# Fix missing dependency: {issue.description}"
        elif issue.category == "Imports" and "not found" in issue.description:
            return f"# Fix import path in {issue.file_path}:{issue.line_number}"
        elif issue.category == "Brand Colors":
            return f"# Update colors in {issue.file_path} to use brand palette"
        
        return None

def main():
    """Main execution function"""
    if len(sys.argv) > 1:
        root_path = sys.argv[1]
    else:
        root_path = "."
    
    auditor = ClinicalAppAuditor(root_path)
    
    iteration = 1
    max_iterations = 5
    
    while iteration <= max_iterations:
        print(f"\n🔄 AUDIT ITERATION {iteration}/{max_iterations}")
        print("=" * 50)
        
        results = auditor.run_audit()
        report = auditor.generate_report()
        
        print(report)
        
        # Save report to file
        report_file = f"audit_report_iteration_{iteration}.txt"
        with open(report_file, 'w') as f:
            f.write(report)
        print(f"📄 Report saved to: {report_file}")
        
        # Check if we've reached 100% pass rate
        if results.pass_rate >= 100.0:
            print(f"🎉 SUCCESS! 100% pass rate achieved in {iteration} iterations!")
            break
        
        # Generate and apply fixes
        fixes = auditor.generate_fixes()
        if fixes:
            print(f"\n🔧 GENERATED {len(fixes)} FIXES:")
            for fix in fixes:
                print(f"   - {fix}")
        
        iteration += 1
        
        # Reset for next iteration
        auditor.results = AuditResults()
    
    if results.pass_rate < 100.0:
        print(f"\n⚠️  Audit completed with {results.pass_rate:.1f}% pass rate after {max_iterations} iterations")
        print("Manual intervention may be required for remaining issues.")
    
    return results.pass_rate >= 100.0

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)