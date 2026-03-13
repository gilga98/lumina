import Foundation
import Vision
import CoreImage
import AppKit

func processImages() {
    let fileManager = FileManager.default
    let medicalDirPath = "/Users/gsharma/Desktop/lumina/assets/medical/"
    
    do {
        let items = try fileManager.contentsOfDirectory(atPath: medicalDirPath)
        let pngFiles = items.filter { $0.lowercased().hasSuffix(".png") }.sorted()
        
        print("Found \(pngFiles.count) images to process.")
        
        for (index, fileName) in pngFiles.enumerated() {
            let inputPath = medicalDirPath + fileName
            print("[\(index + 1)/\(pngFiles.count)] Processing \(fileName)...")
            
            guard let image = NSImage(contentsOfFile: inputPath),
                  let tiffData = image.tiffRepresentation,
                  let ciImage = CIImage(data: tiffData) else {
                print("Failed to load \(fileName)")
                continue
            }
            
            let request = VNGenerateForegroundInstanceMaskRequest()
            let handler = VNImageRequestHandler(ciImage: ciImage, options: [:])
            
            do {
                try handler.perform([request])
                
                guard let result = request.results?.first else {
                    print("No subject found in \(fileName)")
                    continue
                }
                
                // Get the mask as a CVPixelBuffer
                let maskBuffer = try result.generateMaskedImage(
                    ofInstances: result.allInstances,
                    from: handler,
                    croppedToInstancesExtent: false
                )
                
                // Convert the mask/result to CIImage
                let outputCIImage = CIImage(cvPixelBuffer: maskBuffer)
                
                // Render to NSImage/Data and save
                let rep = NSCIImageRep(ciImage: outputCIImage)
                let outputNSImage = NSImage(size: rep.size)
                outputNSImage.addRepresentation(rep)
                
                if let pngData = outputNSImage.pngData() {
                    try pngData.write(to: URL(fileURLWithPath: inputPath))
                    print("Successfully processed \(fileName)")
                } else {
                    print("Failed to generate PNG data for \(fileName)")
                }
                
            } catch {
                print("Error processing \(fileName): \(error)")
            }
        }
        
        print("All images processed.")
        
    } catch {
        print("Error reading directory: \(error)")
    }
}

extension NSImage {
    func pngData() -> Data? {
        guard let tiffRepresentation = tiffRepresentation,
              let bitmapImage = NSBitmapImageRep(data: tiffRepresentation) else { return nil }
        return bitmapImage.representation(using: .png, properties: [:])
    }
}

processImages()
