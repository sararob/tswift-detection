
// Copyright 2017 Google LLC

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     https://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//
//  ViewController.swift
//  objDetection
//
//  Created by Sara Robinson on 12/5/17.
//  Copyright © 2017 Sara Robinson. All rights reserved.
//

import UIKit
import Firebase
import Photos

class ViewController: UIViewController, UIImagePickerControllerDelegate, UINavigationControllerDelegate {

    let imagePicker = UIImagePickerController()
    
    var storage: Storage!
    var firestore: Firestore!

    @IBOutlet weak var spinner: UIActivityIndicatorView!
    @IBOutlet weak var resultText: UITextView!
    @IBOutlet weak var predictedImgView: UIImageView!
    @IBOutlet weak var navBar: UINavigationBar!
    @IBOutlet weak var noTaylorText: UITextView!
    
    @IBAction func selectImg(_ sender: Any) {
        print("button pressed!")
        guard UIImagePickerController.isSourceTypeAvailable(.photoLibrary) else {
            print("can't open photo lib")
            return
        }
        self.predictedImgView.image = nil
        self.resultText.text = ""
        imagePicker.sourceType = .photoLibrary
        
        present(imagePicker, animated: true)
    }
    
    func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [String : Any]) {
        
        spinner.isHidden = false
        spinner.startAnimating()
        
        let imageURL = info[UIImagePickerControllerImageURL] as? URL
        let imageName = imageURL?.lastPathComponent
        let storageRef = storage.reference().child("images").child(imageName!)

        storageRef.putFile(from: imageURL!, metadata: nil) { metadata, error in
            if let error = error {
                print(error)
            } else {
                print("uplaod success!")

                self.firestore.collection("predicted_images").document(imageName!)
                    .addSnapshotListener { documentSnapshot, error in
                        if let error = error {
                            print("error occurred\(error)")
                        } else {
                            print("here")
                            if (documentSnapshot?.exists)! {
                                print(documentSnapshot?.data())
                                let imageData = (documentSnapshot?.data())
                                self.visualizePrediction(imgData: imageData)
                            } else {
                                print("waiting for prediction data...")
                            }

                        }
                }

            }
        }
        dismiss(animated: true, completion: nil)
    }
    
    func visualizePrediction(imgData: [String: Any]?) {
        self.spinner.stopAnimating()
        self.spinner.isHidden = true
        let confidence = imgData!["confidence"] as! Double * 100
        
        if (imgData!["image_path"] as! String).isEmpty {
            self.noTaylorText.text = "No Taylor found 😢"
        } else {
            let predictedImgRef = storage.reference(withPath: imgData!["image_path"] as! String)
            predictedImgRef.getData(maxSize: 1 * 1024 * 1024) { data, error in
                if let error = error {
                    print(error)
                } else {
                    let image = UIImage(data: data!)
                    self.resultText.text = "Found Taylor! \(String(format: "%.2f", confidence))% confidence"
                    self.predictedImgView.contentMode = .scaleAspectFit
                    self.predictedImgView.image = image
                }
            }
        }


    }
    
    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        dismiss(animated: true, completion: nil)
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        // Do any additional setup after loading the view, typically from a nib.
        imagePicker.delegate = self
        storage = Storage.storage()
        firestore = Firestore.firestore()
        spinner.isHidden = true
    }
    
    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
        // Dispose of any resources that can be recreated.
    }


}

