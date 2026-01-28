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
    dependencies: [
        .package(url: "https://github.com/gonzalezreal/swift-markdown-ui", from: "2.4.0")
    ],
    targets: [
        .executableTarget(
            name: "Inc",
            dependencies: [
                .product(name: "MarkdownUI", package: "swift-markdown-ui")
            ],
            resources: [
                .process("Resources")
            ]
        )
    ]
)
