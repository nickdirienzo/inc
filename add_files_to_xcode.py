#!/usr/bin/env python3
"""
Script to add all Swift files to the Inc Xcode project.
This modifies the project.pbxproj file to include all Swift source files.
"""

import os
import sys
import re
from pathlib import Path

def generate_id(prefix, counter):
    """Generate unique IDs for Xcode objects"""
    # Use a different prefix to avoid conflicts with existing IDs
    return f"{prefix}{counter:020d}"

def main():
    project_dir = Path('/Users/nickdirienzo/.inc/projects/6ab1299544aa/workspaces/543b082c/task-22/inc-mac')
    pbxproj_path = project_dir / 'Inc.xcodeproj' / 'project.pbxproj'

    # Find all Swift files
    inc_dir = project_dir / 'Inc'
    swift_files = []

    for directory in ['Views', 'ViewModels', 'Models', 'Services', 'Components']:
        dir_path = inc_dir / directory
        if dir_path.exists():
            for swift_file in sorted(dir_path.glob('*.swift')):
                swift_files.append((directory, swift_file.name))

    # Filter out files that already exist in project (IncApp.swift, ContentView.swift)
    files_to_add = [(d, f) for d, f in swift_files
                    if f not in ['IncApp.swift', 'ContentView.swift']]

    print(f"Found {len(files_to_add)} files to add to Xcode project")

    # Read current project file
    with open(pbxproj_path, 'r') as f:
        lines = f.readlines()

    # Generate entries for each file
    file_ref_entries = []
    build_file_entries = []
    sources_entries = []
    group_entries = {dir: [] for dir in ['Views', 'ViewModels', 'Models', 'Services', 'Components']}

    counter = 5000
    for directory, filename in files_to_add:
        file_ref_id = generate_id('BB', counter)
        build_file_id = generate_id('CC', counter)
        counter += 1

        # PBXFileReference
        file_ref_entries.append(
            f'\t\t{file_ref_id} /* {filename} */ = '
            f'{{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; '
            f'path = {filename}; sourceTree = "<group>"; }};\n'
        )

        # PBXBuildFile
        build_file_entries.append(
            f'\t\t{build_file_id} /* {filename} in Sources */ = '
            f'{{isa = PBXBuildFile; fileRef = {file_ref_id} /* {filename} */; }};\n'
        )

        # Sources phase entry
        sources_entries.append(f'\t\t\t\t{build_file_id} /* {filename} in Sources */,\n')

        # Group entry
        group_entries[directory].append(f'\t\t\t\t{file_ref_id} /* {filename} */,\n')

    # Now modify the file
    output_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]

        # Insert build file entries after the PBXBuildFile section starts
        if '/* Begin PBXBuildFile section */' in line:
            output_lines.append(line)
            i += 1
            # Add existing entries
            while i < len(lines) and '/* End PBXBuildFile section */' not in lines[i]:
                output_lines.append(lines[i])
                i += 1
            # Add new entries
            output_lines.extend(build_file_entries)
            output_lines.append(lines[i])  # End section line
            i += 1
            continue

        # Insert file reference entries
        if '/* Begin PBXFileReference section */' in line:
            output_lines.append(line)
            i += 1
            # Add existing entries, but remove folder references
            while i < len(lines) and '/* End PBXFileReference section */' not in lines[i]:
                # Skip folder references for our directories
                if 'lastKnownFileType = folder;' in lines[i] and any(
                    f'/* {dir} */' in lines[i] for dir in ['Models', 'ViewModels', 'Views', 'Services', 'Components']
                ):
                    i += 1
                    continue
                output_lines.append(lines[i])
                i += 1
            # Add new file references
            output_lines.extend(file_ref_entries)
            output_lines.append(lines[i])  # End section line
            i += 1
            continue

        # Update PBXGroup section - need to create actual group definitions
        if '/* End PBXGroup section */' in line:
            # Add group definitions for each directory before the end
            dir_id_map = {
                'Models': 'AA0000100000000000000001',
                'ViewModels': 'AA0000110000000000000001',
                'Views': 'AA0000120000000000000001',
                'Services': 'AA0000130000000000000001',
                'Components': 'AA0000140000000000000001'
            }

            for directory, group_id in dir_id_map.items():
                if group_entries[directory]:
                    output_lines.append(f'\t\t{group_id} /* {directory} */ = {{\n')
                    output_lines.append('\t\t\tisa = PBXGroup;\n')
                    output_lines.append('\t\t\tchildren = (\n')
                    output_lines.extend(group_entries[directory])
                    output_lines.append('\t\t\t);\n')
                    output_lines.append(f'\t\t\tpath = {directory};\n')
                    output_lines.append('\t\t\tsourceTree = "<group>";\n')
                    output_lines.append('\t\t};\n')

            output_lines.append(line)
            i += 1
            continue

        # Update sources phase
        if 'AA9999940000000000000001 /* Sources */ = {' in line:
            output_lines.append(line)
            i += 1
            # Copy until we find the files array
            while i < len(lines) and 'files = (' not in lines[i]:
                output_lines.append(lines[i])
                i += 1
            output_lines.append(lines[i])  # files = ( line
            i += 1
            # Add existing source files
            while i < len(lines) and ');' not in lines[i]:
                output_lines.append(lines[i])
                i += 1
            # Add new source files
            output_lines.extend(sources_entries)
            output_lines.append(lines[i])  # ); line
            i += 1
            continue

        output_lines.append(line)
        i += 1

    # Write back
    with open(pbxproj_path, 'w') as f:
        f.writelines(output_lines)

    print(f"✅ Successfully added {len(files_to_add)} Swift files to Xcode project")
    for directory, filename in files_to_add:
        print(f"   - {directory}/{filename}")

    return 0

if __name__ == '__main__':
    sys.exit(main())
