//
//  EpicListView.swift
//  Inc
//
//  Main epic list view for the left sidebar
//

import SwiftUI

struct EpicListView: View {
    let projectRoot: String
    @ObservedObject var viewModel: EpicListViewModel
    @State private var showingNewEpicSheet = false
    @State private var newEpicDescription = ""

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Epics")
                    .font(.headline)
                    .fontWeight(.semibold)

                Button(action: {
                    showingNewEpicSheet = true
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "plus")
                        Text("New Epic")
                    }
                    .font(.caption)
                }
                .buttonStyle(.borderless)

                Spacer()
                Toggle("Hide Done", isOn: $viewModel.hideDone)
                    .toggleStyle(.checkbox)
                    .font(.caption)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)

            Divider()

            // Epic list
            if viewModel.epics.isEmpty {
                // Empty state
                VStack(spacing: 8) {
                    Image(systemName: "folder")
                        .font(.system(size: 48))
                        .foregroundColor(.secondary)
                    Text("No epics found")
                        .font(.body)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding()
            } else {
                // Scrollable epic list
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(viewModel.filteredEpics) { epic in
                            EpicRow(
                                epic: epic,
                                isSelected: epic.epic.id == viewModel.selectedEpicId
                            )
                            .onTapGesture {
                                viewModel.selectEpic(epic.epic.id)
                            }
                            .contentShape(Rectangle())

                            Divider()
                                .padding(.leading, 12)
                        }
                    }
                }
            }
        }
        .frame(minWidth: 250, idealWidth: 300, maxWidth: 400)
        .background(Color(NSColor.controlBackgroundColor))
        .sheet(isPresented: $showingNewEpicSheet) {
            NewEpicSheet(
                isPresented: $showingNewEpicSheet,
                description: $newEpicDescription,
                projectRoot: projectRoot,
                viewModel: viewModel,
                onSuccess: { epicId in
                    viewModel.selectEpic(epicId)
                    newEpicDescription = ""
                }
            )
        }
    }
}

// MARK: - EpicRow Component

struct EpicRow: View {
    let epic: EpicWithTasks
    let isSelected: Bool
    @State var isHovering = false

    private var shortId: String {
        String(epic.epic.id.prefix(8))
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    Text(shortId)
                        .font(.system(.callout, design: .monospaced))
                        .fontWeight(.semibold)
                        .foregroundColor(.primary)
                    if let slug = epic.registryEntry.slug, !slug.isEmpty {
                        Text(slug)
                            .font(.callout)
                            .foregroundColor(.secondary)
                    }
                }

                Text(epic.epic.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)

                StatusBadge(status: epic.epic.status)

                // Task progress (if tasks exist)
                if epic.hasTasks {
                    Text("\(epic.taskProgressString) tasks")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            // Right side: Attention indicator
            if epic.epic.needsAttention {
                Image(systemName: "exclamationmark.circle.fill")
                    .font(.system(size: 18))
                    .foregroundColor(.red)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            isSelected ? Color.accentColor.opacity(0.2) : (isHovering ? Color.accentColor.opacity(0.08) : Color.clear)
        )
        .onHover { hovering in
            isHovering = hovering
        }
    }
}

// MARK: - StatusBadge Component

struct StatusBadge: View {
    let status: EpicStatus

    var body: some View {
        Text(status.displayName)
            .font(.caption)
            .fontWeight(.medium)
            .foregroundColor(.white)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill(statusColor)
            )
    }

    private var statusColor: Color {
        switch status {
        case .new:
            return .gray
        case .spec_in_progress:
            return .blue
        case .spec_complete:
            return .cyan
        case .plan_in_progress:
            return .purple
        case .plan_complete:
            return .purple.opacity(0.7)
        case .coding:
            return .orange
        case .review:
            return .orange.opacity(0.8)
        case .pending_validation:
            return .yellow
        case .done:
            return .green
        case .abandoned:
            return .red
        }
    }
}

// MARK: - NewEpicSheet Component

struct NewEpicSheet: View {
    @Binding var isPresented: Bool
    @Binding var description: String
    let projectRoot: String
    let viewModel: EpicListViewModel
    let onSuccess: (String) -> Void

    @State private var isCreating = false
    @State private var errorMessage: String? = nil

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Create New Epic")
                    .font(.headline)
                    .fontWeight(.semibold)
                Spacer()
            }
            .padding()

            Divider()

            // Form
            Form {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Epic Description")
                            .font(.subheadline)
                            .fontWeight(.medium)

                        TextField("Enter epic description", text: $description, axis: .vertical)
                            .textFieldStyle(.roundedBorder)
                            .lineLimit(3...6)
                            .disabled(isCreating)
                    }

                    // Button row
                    HStack {
                        Spacer()

                        Button("Cancel") {
                            isPresented = false
                        }
                        .keyboardShortcut(.cancelAction)
                        .disabled(isCreating)

                        Button("Create") {
                            createEpic()
                        }
                        .keyboardShortcut(.defaultAction)
                        .disabled(description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isCreating)
                        .buttonStyle(.borderedProminent)
                    }

                    // Loading indicator
                    if isCreating {
                        HStack {
                            Spacer()
                            ProgressView()
                                .controlSize(.small)
                            Text("Creating epic...")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Spacer()
                        }
                    }
                }
                .padding()
            }
            .formStyle(.grouped)
        }
        .frame(width: 400, height: 250)
        .alert("Error Creating Epic", isPresented: .constant(errorMessage != nil)) {
            Button("OK") {
                errorMessage = nil
            }
        } message: {
            if let errorMessage = errorMessage {
                Text(errorMessage)
            }
        }
    }

    private func createEpic() {
        _Concurrency.Task {
            isCreating = true
            defer { isCreating = false }

            do {
                let epicId = try await viewModel.createEpic(
                    description: description.trimmingCharacters(in: .whitespacesAndNewlines),
                    projectRoot: projectRoot
                )

                // Success - dismiss sheet and call success handler
                isPresented = false
                onSuccess(epicId)
            } catch {
                // Show error alert
                errorMessage = error.localizedDescription
            }
        }
    }
}

// MARK: - Preview

struct EpicListView_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            // Preview with epics
            EpicListView(
                projectRoot: "/Users/test/projects/myapp",
                viewModel: {
                    let vm = EpicListViewModel()
                    // Create mock data
                    let mockRegistry1 = RegistryEntry(
                    epicId: "abc123",
                    slug: "user-auth",
                    projectPath: "/Users/test/projects/myapp",
                    description: "Implement user authentication",
                    createdAt: "2024-01-01T10:00:00Z",
                    updatedAt: "2024-01-26T15:30:00Z"
                )
                let mockEpic1 = Epic(
                    id: "abc123",
                    slug: "user-auth",
                    description: "Implement user authentication",
                    status: .coding,
                    created_at: "2024-01-01T10:00:00Z",
                    updated_at: "2024-01-26T15:30:00Z",
                    needs_attention: nil,
                    pr_number: nil,
                    workspace_path: nil,
                    merged_at: nil
                )
                let mockTasks1 = TasksFile(tasks: [
                    Task(id: 1, name: "Setup", description: "Setup auth", status: .done, blocked_by: [], assignee: nil, jj_commit: nil, feedback: nil),
                    Task(id: 2, name: "Login", description: "Add login", status: .in_progress, blocked_by: [], assignee: nil, jj_commit: nil, feedback: nil),
                    Task(id: 3, name: "Logout", description: "Add logout", status: .not_started, blocked_by: [], assignee: nil, jj_commit: nil, feedback: nil)
                ])

                let mockRegistry2 = RegistryEntry(
                    epicId: "def456",
                    slug: "dashboard",
                    projectPath: "/Users/test/projects/myapp",
                    description: "Create admin dashboard",
                    createdAt: "2024-01-15T10:00:00Z",
                    updatedAt: "2024-01-25T12:00:00Z"
                )
                let mockEpic2 = Epic(
                    id: "def456",
                    slug: "dashboard",
                    description: "Create admin dashboard",
                    status: .spec_complete,
                    created_at: "2024-01-15T10:00:00Z",
                    updated_at: "2024-01-25T12:00:00Z",
                    needs_attention: NeedsAttention(
                        from: .pm,
                        to: .user,
                        question: "Should we include analytics?",
                        message: nil,
                        escalation_count: 0
                    ),
                    pr_number: nil,
                    workspace_path: nil,
                    merged_at: nil
                )

                let mockRegistry3 = RegistryEntry(
                    epicId: "ghi789",
                    slug: nil,
                    projectPath: "/Users/test/projects/myapp",
                    description: "Fix critical bug",
                    createdAt: "2024-01-20T10:00:00Z",
                    updatedAt: "2024-01-24T09:00:00Z"
                )
                let mockEpic3 = Epic(
                    id: "ghi789",
                    slug: "",
                    description: "Fix critical bug",
                    status: .done,
                    created_at: "2024-01-20T10:00:00Z",
                    updated_at: "2024-01-24T09:00:00Z",
                    needs_attention: nil,
                    pr_number: 42,
                    workspace_path: nil,
                    merged_at: "2024-01-24T09:00:00Z"
                )

                vm.epics = [
                    EpicWithTasks(epic: mockEpic1, registryEntry: mockRegistry1, tasksFile: mockTasks1),
                    EpicWithTasks(epic: mockEpic2, registryEntry: mockRegistry2, tasksFile: nil),
                    EpicWithTasks(epic: mockEpic3, registryEntry: mockRegistry3, tasksFile: nil)
                ]
                vm.selectedEpicId = "abc123"
                return vm
            }()
            )
            .frame(width: 300, height: 600)
            .previewDisplayName("With Epics - Light")
            .preferredColorScheme(.light)

            // Preview with epics (Dark Mode)
            EpicListView(
                projectRoot: "/Users/test/projects/myapp",
                viewModel: {
                    let vm = EpicListViewModel()
                    let mockRegistry1 = RegistryEntry(
                    epicId: "abc123",
                    slug: "user-auth",
                    projectPath: "/Users/test/projects/myapp",
                    description: "Implement user authentication",
                    createdAt: "2024-01-01T10:00:00Z",
                    updatedAt: "2024-01-26T15:30:00Z"
                )
                let mockEpic1 = Epic(
                    id: "abc123",
                    slug: "user-auth",
                    description: "Implement user authentication",
                    status: .coding,
                    created_at: "2024-01-01T10:00:00Z",
                    updated_at: "2024-01-26T15:30:00Z",
                    needs_attention: nil,
                    pr_number: nil,
                    workspace_path: nil,
                    merged_at: nil
                )
                vm.epics = [
                    EpicWithTasks(epic: mockEpic1, registryEntry: mockRegistry1, tasksFile: nil)
                ]
                return vm
            }()
            )
            .frame(width: 300, height: 600)
            .previewDisplayName("With Epics - Dark")
            .preferredColorScheme(.dark)

            // Preview with no epics
            EpicListView(
                projectRoot: "/Users/test/projects/myapp",
                viewModel: EpicListViewModel()
            )
            .frame(width: 300, height: 600)
                .previewDisplayName("No Epics")
        }
    }
}
