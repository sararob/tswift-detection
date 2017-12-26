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

'use strict';

const functions = require('firebase-functions');
const gcs = require('@google-cloud/storage');
const admin = require('firebase-admin');
const exec = require('child_process').exec;
const path = require('path');
const fs = require('fs');
const google = require('googleapis');
const sizeOf = require('image-size');

admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

function cmlePredict(b64img) {
    return new Promise((resolve, reject) => {
        google.auth.getApplicationDefault(function (err, authClient) {
            if (err) {
                reject(err);
            }
            if (authClient.createScopedRequired && authClient.createScopedRequired()) {
                authClient = authClient.createScoped([
                    'https://www.googleapis.com/auth/cloud-platform'
                ]);
            }

            var ml = google.ml({
                version: 'v1'
            });

            const params = {
                auth: authClient,
                name: 'projects/your-project-name/models/your-model-name',
                resource: {
                    instances: [
                    {
                        "inputs": {
                        "b64": b64img
                        }
                    }
                    ]
                }
            };

            ml.projects.predict(params, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    });
}

function resizeImg(filepath) {
    return new Promise((resolve, reject) => {
        exec(`convert ${filepath} -resize 600x ${filepath}`, (err) => {
          if (err) {
            console.error('Failed to resize image', err);
            reject(err);
          } else {
            console.log('resized image successfully');
            resolve(filepath);
          }
        });
      });
}

exports.runPrediction = functions.storage.object().onChange((event) => {

    fs.rmdir('./tmp/', (err) => {
        if (err) {
            console.log('error deleting tmp/ dir');
        }
    });

    const object = event.data;
    const fileBucket = object.bucket;
    const filePath = object.name;
    const bucket = gcs().bucket(fileBucket);
    const fileName = path.basename(filePath);
    const file = bucket.file(filePath);

    if (filePath.startsWith('images/')) {  
        const destination = '/tmp/' + fileName;
        console.log('got a new image', filePath);
        return file.download({
            destination: destination
        }).then(() => {
            if(sizeOf(destination).width > 600) {
                console.log('scaling image down...');
                return resizeImg(destination);
            } else {
                return destination;
            }
        }).then(() => {
            console.log('base64 encoding image...');
            let bitmap = fs.readFileSync(destination);
            return new Buffer(bitmap).toString('base64');
        }).then((b64string) => {
            console.log('sending image to CMLE...');
            return cmlePredict(b64string);
        }).then((result) => {
            let boxes = result.predictions[0].detection_boxes;
            let scores = result.predictions[0].detection_scores;

            console.log('got prediction with confidence: ',scores[0]);
            // Only output predictions with confidence > 70%
            if (scores[0] >= 0.7) {
                let dimensions = sizeOf(destination);
                let box = boxes[0];
                let x0 = box[1] * dimensions.width;
                let y0 = box[0] * dimensions.height;
                let x1 = box[3] * dimensions.width;
                let y1 = box[2] * dimensions.height;    
    
                // Draw a box on the image around the predicted bounding box
                return new Promise((resolve, reject) => {
                    console.log(destination);
                    exec(`convert ${destination} -stroke "#39ff14" -strokewidth 10 -fill none -draw "rectangle ${x0},${y0},${x1},${y1}" ${destination}`, (err) => {
                      if (err) {
                        console.error('Failed to draw rect.', err);
                        reject(err);
                      } else {
                        console.log('drew the rect');
                        bucket.upload(destination, {destination: 'test2.jpg'})
                        resolve(scores[0]);
                      }
                    });
                  });
            } else {
                return scores[0];
            }
        })
        .then((confidence) => {
            let outlinedImgPath = '';
            let imageRef = db.collection('predicted_images').doc(filePath.slice(7));
            if (confidence > 0.7) {
                outlinedImgPath = `outlined_img/${filePath.slice(7)}`;
                imageRef.set({
                    image_path: outlinedImgPath,
                    confidence: confidence
                });
                return bucket.upload(destination, {destination: outlinedImgPath});
            } else {
                imageRef.set({
                    image_path: outlinedImgPath,
                    confidence: confidence
                });
                console.log('No tswift found');
                return confidence;
            }
        })
        .catch(err => {
            console.log('Error occurred: ',err);
        });
    } else {
        return 'not a new image';
    }
});