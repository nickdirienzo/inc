// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Inc",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "Inc", targets: ["Inc"])
    ],
    targets: [
        .executableTarget(
            name: "Inc",
            resources: [
                .process("Resources")
            ]
        )
    ]
)
