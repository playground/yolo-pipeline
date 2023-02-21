#! /usr/bin/env node
const {renameSync, readdir, readdirSync, copyFileSync, copyFile, existsSync, mkdirSync, openSync, readFile, readFileSync, writeFileSync, writeFile} = require('fs');
const jsonfile = require('jsonfile');
const convert = require('xml-js');
const { Observable, forkJoin, bindCallback } = require('rxjs');
const {createCanvas, Image, loadImage} = require('canvas');
const cp = require('child_process'),
exec = cp.exec;

const task = process.env.npm_config_task || 'rename_maximo_assets';
const modelODPath = `/server/models/research/object_detection`;
const count = process.env.npm_config_count || 100;
let imageSrcPath = process.env.npm_config_image_source_path;
let imagePath = process.env.npm_config_image_path;
const label = process.env.npm_config_label;
let folder = process.env.npm_config_folder || imagePath.split("/").pop();
let imageRefFolder = process.env.npm_config_image_ref_folder;
let imageSize = {
  width: 800,
  height: 600
}
let orgImage = {
  width: 256,
  height: 256
}
let imageTypes = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png'
}

let build = {
  resize_image: () => {
    return new Observable((observer) => {
      const image_dir = process.env.npm_config_image_dir || imagePath; 
      const height = process.env.npm_config_height;
      const width = process.env.npm_config_width;

      if(!image_dir || !height || !width) {
        build.exit('image_dir, height & width are required, provide --image_dir=...');
      }
      let arg = `python ${__dirname}/resize_images.py -d ${image_dir} -s ${width} ${height}`;
      exec(arg, {maxBuffer: 1024 * 2000}, (err, stdout, stderr) => {
        if(!err) {
          console.log(`done resizing ${image_dir}`);
          observer.next();
          observer.complete();
        } else {
          console.log(`failed to resize images ${image_dir}`, err);
        }
      });

    });
  },
  rename_maximo_assets: () => {
    return new Observable((observer) => {
      const path = process.env.npm_config_image_dir || imagePath;
      let count = 0;
      if(!path) {
        build.exit('path is required, provide --image_dir=...');
      }
      let json = jsonfile.readFileSync(`${path}/prop.json`);
      if (json) {
        let fileInfo = JSON.parse(json['file_prop_info']);
        fileInfo.map((info) => {
          // console.log(info['original_file_name']);
          let type = /\.[0-9a-z]{1,5}$/i.exec(info.original_file_name)[0];
          let name = info.original_file_name.replace(type, '');
          let idtuple = /^[^-]*/.exec(info._id)[0];
          if(info.original_file_name === '0001.jpg') {
            console.log(`${path}/${info._id}${type}`, `${path}/${info.original_file_name}`)
            console.log(`${path}/${info._id}.xml`, `${path}/${name}.xml`, idtuple)
          }
          if(existsSync(`${path}/${info._id}.xml`) && existsSync(`${path}/${info._id}${type}`)) {
            renameSync(
              `${path}/${info._id}${type}`, 
              `${path}/${name}${type}`);
            renameSync(
              `${path}/${info._id}.xml`, 
              `${path}/${name}.xml`);
            count++;
          }    
        })
        console.log(`renamed total of ${count} image files and ${count} xml files`)
        observer.next();
        observer.complete();
      } else {
        build.exit(json);
      }
    });
  },
  rename_maximo_assets2: () => {
    return new Observable((observer) => {
      const path = process.env.npm_config_image_dir || imagePath;
      let count = 0;
      if(!path) {
        build.exit('path is required, provide --image_dir=...');
      }
      let json = jsonfile.readFileSync(`${path}/prop.json`);
      if (json) {
        let fileInfo = JSON.parse(json['file_prop_info']);
        fileInfo.map((info) => {
          // console.log(info['original_file_name']);
          let type = /\.[0-9a-z]{1,5}$/i.exec(info.original_file_name)[0];
          let name = info.original_file_name.replace(type, '');
          // console.log(`${path}/${info._id}${type}`, `${path}/${info.original_file_name}`)
          // console.log(`${path}/${info._id}.xml`, `${path}/${name}.xml`)
          if(existsSync(`${path}/${info._id}.xml`) && existsSync(`${path}/${info._id}${type}`)) {
            renameSync(
              `${path}/${info._id}${type}`, 
              `${path}/${info.original_file_name}`);
            renameSync(
              `${path}/${info._id}.xml`, 
              `${path}/${name}.xml`);
            count++;
          }    
        })
        console.log(`renamed total of ${count} image files and ${count} xml files`)
        observer.next();
        observer.complete();
      } else {
        build.exit(json);
      }
    });
  },
  partition_dataset: () => {
    return new Observable((observer) => {
      const path = process.env.npm_config_image_dir || imagePath;
    if(!path) {
      build.exit('path is required, provide --image_dir=...');
    }
    const train_ratio = process.env.npm_config_ratio || 0.9;
    let files = readdirSync(path);
      const assets = files.filter((file) => file.match(/jpg|png|gif|jpeg/i));
      const train_num = parseInt(assets.length * train_ratio);
      if(!existsSync(`${path}/train`)) {
        mkdirSync(`${path}/train`)
      } else {
        build.exit('train directory already exists');
      }
      if(!existsSync(`${path}/test`)) {
        mkdirSync(`${path}/test`)
      } else {
        build.exit('test directory already exists');
      }
      assets.forEach((asset, i) => {
        // console.log(asset, i)
        let type = /\.[0-9a-z]{1,5}$/i.exec(asset)[0];
        let name = asset.replace(type, '');
        let target = i < train_num ? 'train' : 'test';
        if(existsSync(`${path}/${name}.xml`) && existsSync(`${path}/${asset}`)) {
          copyFileSync(`${path}/${asset}`, `${path}/${target}/${asset}`);
          copyFileSync(`${path}/${name}.xml`, `${path}/${target}/${name}.xml`);
        }
      })
      console.log(`total: ${assets.length}, train: ${train_num}, test: ${assets.length-train_num}`);
      observer.next();
      observer.complete();
    });  
  },
  xml_to_csv: () => {
    return new Observable((observer) => {
      const path = process.env.npm_config_image_dir || imagePath;
      const origin = process.env.npm_config_origin || ''; //maximo or ''
      let xmls, csv = '';
      let $call = [];
      if(!path) {
        build.exit('path is required, provide --image_dir=... --origin=...');
      }
      ['train', 'test'].forEach((target) => {
        const dir = `${path}/${target}`;
        console.log(path, target, origin)
        let files = readdirSync(dir);
        xmls = files.filter((file) => file.indexOf('.xml') > 0);
        // console.log(xmls)
        if(origin && origin.toLowerCase() === 'maximo') {
          $call.push(build.maximo(xmls, dir, path));
        } else {
          $call.push(build.tfjs(xmls, dir, path));
        }
      })
      forkJoin($call)
      .subscribe((data) => {
        writeFileSync(`${path}/train/labels.csv`, data[0]);
        writeFileSync(`${path}/test/labels.csv`, data[1]);
        console.log('generating label.csv for train and test');
        observer.next();
        observer.complete();
        // console.log(data[0], data.length)
        // console.log(data[1], data.length)
      })
    });  
  },
  xml_to_txt: () => {
    return new Observable((observer) => {
      const path = process.env.npm_config_image_dir || imagePath;
      const origin = process.env.npm_config_origin || ''; //maximo or ''
      let xmls, csv = '';
      let $call = [];
      if(!path) {
        build.exit('path is required, provide --image_dir=... --origin=...');
      }
      ['images', 'labels'].forEach((dir) => {
        if(!existsSync(`${path}/${dir}`)) {
          mkdirSync(`${path}/${dir}`)
        }  
      })      
      console.log(path, origin)
      let files = readdirSync(path);
      xmls = files.filter((file) => file.indexOf('.xml') > 0);
      // console.log(xmls)
      if(origin && origin.toLowerCase() === 'maximo') {
        $call.push(build.maximo_to_yolo(xmls, path));
      } else {
        $call.push(build.tfjs_to_yolo(xmls, path));
      }
      forkJoin($call)
      .subscribe((data) => {
        console.log('generating yolo for train and test');
        observer.next();
        observer.complete();
      })
    });  
  },
  tfjs_to_yolo: (xmls, path) => {
    return new Observable((observer) => {
      let $save = {};
      try {
        let classes = readFileSync(`${path}/classes.txt`).toString().split('\n')
        console.log(classes)

        xmls.forEach(async(name, i) => {
          let xml = readFileSync(`${path}/${name}`);
          let xmljson = JSON.parse(convert.xml2json(xml, {compact: true, space: 2}));
          // console.log(xmljson.annotation.object)
          let filename = xmljson.annotation.filename._text;
          if(filename.indexOf('.') < 0) {
            if(existsSync(`${path}/${filename}.jpg`)) {
              filename += '.jpg';
            } else if(existsSync(`${path}/${filename}.jpeg`)) {
              filename += '.jpeg';
            } else if(existsSync(`${path}/${filename}.png`)) {
              filename += '.png';
            } else if(existsSync(`${path}/${filename}.gif`)) {
              filename += '.gif';
            } else {
              console.log(`file not file ${filename}`);
              process.exit(0);
            }
          }
          let object = xmljson.annotation.object;
          let size = xmljson.annotation.size;  
          if(!Array.isArray(object)) {
            object = [object];
          }
          let ext, label, txt = '';
          object.forEach((obj, idx) => {
            let bbox = obj.bndbox;
            let index = classes.findIndex((el) => el == obj.name._text);
            ext = filename.match(/\.[^.]*$/);
            label = filename.replace(ext, '.txt');
            txt += `${index} ${bbox.xmin._text} ${bbox.ymin._text} ${bbox.xmax._text} ${bbox.ymax._text}`;
            if(idx < object.length) {
              txt += '\n'
            }
          })
          //writeFileSync(`${path}/labels/${label}`, txt)
          //copyFileSync(`${path}/${filename}`, `${path}/images/${filename}`)
          $save[label] = new Observable((obs) => {writeFile(`${path}/labels/${label}`, txt, (err) => {obs.next('done'); obs.complete();})})
          $save[filename] = new Observable((obs) => {copyFile(`${path}/${filename}`, `${path}/images/${filename}`, err => {obs.next('done'); obs.complete();})})
        })
        forkJoin($save)
        .subscribe({
          next: (save) => console.log(Object.keys(save).length),
          complete: () => {
            observer.next()
            observer.complete()
          },
          error: (err) => observer.error(err)
        })

      } catch(e) {
        build.exit(`Error: ${e}`)
      }
    });
  }, 
  maximo_to_yolo: (xmls, path) => {
    return new Observable((observer) => {
      let $save = {};
      try {
        let classes = readFileSync(`${path}/classes.txt`).toString().split('\n')
        console.log(classes, xmls.length)
        let json = jsonfile.readFileSync(`${path}/prop.json`);
        if(classes && json) {
          xmls.forEach((name, i) => {
            let xml = readFileSync(`${path}/${name}`);
            let xmljson = JSON.parse(convert.xml2json(xml, {compact: true, space: 2}));
            // console.log(xmljson.annotation.object)
            let object = xmljson.annotation.object;
            let size = xmljson.annotation.size;  

            if (json) {
              let props = JSON.parse(json['file_prop_info']);
              if(!Array.isArray(object)) {
                object = [object];
              }
              let index, prop, ext, label, orgname, fileid, imagename, textname, txt = '';
              object.forEach((obj, idx) => {
                prop = props.filter((f) => f._id === obj.file_id._text);
                if(prop.length != 1) {
                  build.exit(`file mismatched or duplicated: ${prop[0]._id}, ${prop[0].original_file_name}`);
                }
                let bbox = obj.bndbox;
                index = classes.findIndex((el) => el == obj.name._text);
                if(index >= 0) {
                  let width = (bbox.xmax._text - bbox.xmin._text)/size.width._text;
                  let height = (bbox.ymax._text - bbox.ymin._text)/size.height._text;
                  let x_center = bbox.xmin._text/size.width._text + width/2;
                  let y_center = bbox.ymin._text/size.height._text + height/2;
                  if(i <10) {
                    console.log(prop[0]._id, bbox.xmin._text, bbox.ymin._text, bbox.xmax._text, bbox.ymax._text, size.width._text, size.height._text)
                  }
                  if(width >1 || height > 1 || x_center > 1 || y_center > 1) {
                    console.log('****', prop[0]._id, x_center, y_center, width, height, bbox.xmin._text, bbox.ymin._text, bbox.xmax._text, bbox.ymax._text, size.width._text, size.height._text)
                  } 
                  txt += `${index} ${x_center.toFixed(6)} ${y_center.toFixed(6)} ${width.toFixed(6)} ${height.toFixed(6)}`;
                  if(idx < object.length) {
                    txt += '\n'
                  }
                } else {
                  build.exit(`class not found: ${obj.name._text}, ${prop[0].original_file_name}`);
                }
              })
              //writeFileSync(`${path}/labels/${label}`, txt)
              //copyFileSync(`${path}/${fileid}${ext[0]}`, `${path}/images/${orgname}`)
              orgname = prop[0].original_file_name;
              ext = orgname.match(/\.[^.]*$/);
              label = orgname.replace(ext, '.txt');
              fileid = prop[0]._id;
              imagename = `${classes[index]}_${i}${ext[0]}`
              textname = `${classes[index]}_${i}.txt`
              $save[textname] = new Observable((obs) => {writeFile(`${path}/labels/train/${textname}`, txt, (err) => {obs.next(); obs.complete();})})
              $save[imagename] = new Observable((obs) => {copyFile(`${path}/${fileid}${ext[0]}`, `${path}/images/train/${imagename}`, err => {obs.next(); obs.complete();})})

              //$save[fileid+i] = new Observable((obs) => {
              //  (async() => {
              //    console.log(`${path}/labels/${label}`, `${path}/${fileid}${ext[0]}`, i)
              //    writeFileSync(`${path}/labels/${fileid}.txt`, txt)
              //    obs.next()
              //    obs.complete()
              //  })()
              //})
              //$save[fileid] = new Observable((obs) => {
              //  (async() => {
              //    copyFileSync(`${path}/${fileid}${ext[0]}`, `${path}/images/${fileid}${ext[0]}`)
              //    obs.next()
              //    obs.complete()
              //  })()
              //})    
            } else {
              build.exit(json);
            }    
          })
          forkJoin($save)
          .subscribe({
            next: (save) => console.log(Object.keys(save).length),
            complete: () => {
              console.log('complete')
              observer.next()
              observer.complete()
            },
            error: (err) => observer.error(err)
          })
        } else {
          observer.error('Missing classes.txt')
        }
      } catch(e) {
        build.exit(`Error: ${e}`)
      }
    });
  },
  tfjs: (xmls, dir, path) => {
    return new Observable((observer) => {
      let csv = 'filename,width,height,class,xmin,ymin,xmax,ymax\n';
      xmls.forEach(async(name, i) => {
        let xml = readFileSync(`${dir}/${name}`);
        let xmljson = JSON.parse(convert.xml2json(xml, {compact: true, space: 2}));
        // console.log(xmljson.annotation.object)
        let filename = xmljson.annotation.filename._text;
        if(filename.indexOf('.') < 0) {
          if(existsSync(`${dir}/${filename}.jpg`)) {
            filename += '.jpg';
          } else if(existsSync(`${dir}/${filename}.jpeg`)) {
            filename += '.jpeg';
          } else if(existsSync(`${dir}/${filename}.png`)) {
            filename += '.png';
          } else if(existsSync(`${dir}/${filename}.gif`)) {
            filename += '.gif';
          } else {
            console.log(`file not file ${filename}`);
            process.exit(0);
          }
        }
        let object = xmljson.annotation.object;
        let size = xmljson.annotation.size;  
        if(!Array.isArray(object)) {
          object = [object];
        }
        object.forEach((obj) => {
          let bbox = obj.bndbox;
          csv += `${filename},${size.width._text},${size.height._text},${obj.name._text},${bbox.xmin._text},${bbox.ymin._text},${bbox.xmax._text},${bbox.ymax._text}\n`;
        })  
      })
      observer.next(csv);
      observer.complete();
    });
  }, 
  maximo: (xmls, dir, path) => {
    return new Observable((observer) => {
      let csv = 'filename,width,height,class,xmin,ymin,xmax,ymax\n';
      xmls.forEach(async(name, i) => {
        let xml = readFileSync(`${dir}/${name}`);
        let xmljson = JSON.parse(convert.xml2json(xml, {compact: true, space: 2}));
        // console.log(xmljson.annotation.object)
        let object = xmljson.annotation.object;
        let size = xmljson.annotation.size;  
        try {
          let json = jsonfile.readFileSync(`${path}/prop.json`);
            if (json) {
              let props = JSON.parse(json['file_prop_info']);
              if(!Array.isArray(object)) {
                object = [object];
              }
              object.forEach((obj) => {
                let prop = props.filter((f) => f._id === obj.file_id._text);
                if(prop.length != 1) {
                  build.exit(`file mismatched or duplicated: ${prop[0]._id}, ${prop[0].original_file_name}`);
                }
                let bbox = obj.bndbox;
                csv += `${prop[0].original_file_name},${size.width._text},${size.height._text},${obj.name._text},${bbox.xmin._text},${bbox.ymin._text},${bbox.xmax._text},${bbox.ymax._text}\n`;
              })
            } else {
              build.exit(json);
            }    
        } catch(e) {
          build.exit(`${name}: ${e}`)
        }
      })
      observer.next(csv);
      observer.complete();
    });
  },
  build_all: () => {
    return new Observable((observer) => {
      const origin = process.env.npm_config_origin;
      if(origin && origin.toLowerCase() === 'maximo') {
        build.rename_maximo_assets()
        .subscribe(() => {
          build.partition_dataset()
          .subscribe(() => {
            build.xml_to_csv()
            .subscribe(() => {
              build.generate_tfrecords()
              .subscribe(() => {
                observer.next();
                observer.complete();
              });  
            })
          })
        })
      } else {
        build.partition_dataset()
        .subscribe(() => {
          build.xml_to_csv()
          .subscribe(() => {
            build.generate_tfrecords()
            .subscribe(() => {
              observer.next();
              observer.complete();
            });  
          })
        })
      }
    });
  },
  tflite_converter: () => {
    return new Observable((observer) => {
      const saved_model_dir = process.env.npm_config_saved_model_dir;
      const output_path = process.env.npm_config_output_path;
      if(!saved_model_dir || !output_path) {
        build.exit('--output_path & --saved_model_dir are required.')
      }

      let arg = `python ${modelODPath}/tflite_converter.py --saved_model_dir=${saved_model_dir} --output_path=${output_path}`;
      exec(arg, {maxBuffer: 1024 * 1024 * 1024 * 2}, (err, stdout, stderr) => {
        if(!err) {
          console.log(`done coverting saved model to ${output_path}`);
          observer.next();
          observer.complete();
        } else {
          console.log(`failed to generate ${output_path}`, err);
        }
      });
    });
  },
  generate_tfrecords: () => {
    return new Observable((observer) => {
      const image_dir = process.env.npm_config_image_dir || imagePath; 
      if(!image_dir) {
        build.exit('--image_dir is required.')
      }
      let csv_input = `${image_dir}/train/labels.csv`;
      let output_path = `${image_dir}/train/train.tfrecord`;
      let train_image_dir = `${image_dir}/train`;

      let arg = `python ${__dirname}/generate_tfrecord.py --csv_input=${csv_input} --image_dir=${train_image_dir} --output_path=${output_path}`;
      exec(arg, {maxBuffer: 1024 * 2000}, (err, stdout, stderr) => {
        if(!err) {
          console.log(stdout)
          console.log(`done generating ${output_path}`);
          csv_input = `${image_dir}/test/labels.csv`;
          output_path = `${image_dir}/test/train.tfrecord`;
          train_image_dir = `${image_dir}/test`;
          arg = `python ${__dirname}/generate_tfrecord.py --csv_input=${csv_input} --image_dir=${train_image_dir} --output_path=${output_path}`;
          exec(arg, {maxBuffer: 1024 * 2000}, (err, stdout, stderr) => {
            if(!err) {
              console.log(stdout)
              console.log(`done generating ${output_path}`);
              observer.next();
              observer.complete();
            } else {
              console.log(`failed to generate ${output_path}`, err);
            }
          });  
        } else {
          console.log(`failed to generate ${output_path}`, err);
        }
      });
    });  
  },
  train_model: () => {
    return new Observable((observer) => {
      const pipeline_config_path = process.env.npm_config_pipeline_config_path;
      const model_dir = process.env.npm_config_model_dir;

      let arg = `python ${modelODPath}/model_main_tf2.py --pipeline_config_path=${pipeline_config_path} --model_dir=${model_dir} --alsologtostderr`;
      let childProcess = exec(arg, {maxBuffer: 1024 * 2000}, (err, stdout, stderr) => {
        if(!err) {
          console.log(stdout)
          console.log(`done training model ${model_dir}`);
          observer.next();
          observer.complete();
        } else {
          console.log(`failed to train model ${model_dir}`, err);
        }
      });
      childProcess.stdout.on('data', data => console.log(data));
      childProcess.stderr.on('data', data => console.log(data));
      // childProcess.stdout.pipe( process.stdout );
      // childProcess.stderr.pipe( process.stderr );
    });  
  },
  export_inference_graph: () => {
    return new Observable((observer) => {
      const trained_checkpoint_dir = process.env.npm_config_trained_checkpoint_dir;
      const pipeline_config_path = process.env.npm_config_pipeline_config_path;
      const output_directory = process.env.npm_config_output_directory;

      let arg = `python ${modelODPath}/exporter_main_v2.py --trained_checkpoint_dir=${trained_checkpoint_dir} --pipeline_config_path=${pipeline_config_path} --output_directory ${output_directory}`;
      exec(arg, {maxBuffer: 1024 * 2000}, (err, stdout, stderr) => {
        if(!err) {
          console.log(stdout)
          console.log(`done generating ${output_directory}`);
          observer.next();
          observer.complete();
        } else {
          console.log(`failed to generate ${output_directory}`, err);
        }
      });
    });  
  },
  tensorflowjs_convert: () => {
    // tensorflowjs_converter \
    // --input_format=tf_saved_model \
    // --output_format=tfjs_graph_model \
    // --saved_model_tags=serve \
    // --control_flow_v2=True \
    // --signature_name=serving_default \
    // /Users/jeff/Downloads/demo-model/good/inference_graph/saved_model /Users/jeff/Downloads/TFConvertModel

  },
  generate_labels:() => {
    return new Observable((observer) => {
      if(label && imagePath && imageSrcPath) {
        (async() => {
          // console.log(process.cwd(), __dirname)
          let total = +count;
          let counter = 1;
          imagePath = imagePath.endsWith('/') ? imagePath.slice(0, -1) : imagePath;
          let xml = readFileSync(`${__dirname}/label-template.xml`).toString();
          console.log(folder)
          let xmlOut = '';
          let xmlName = '';
          let outputPath = imageRefFolder ? imageRefFolder : imagePath;
          outputPath = outputPath.endsWith('/') ? outputPath.slice(0, -1) : outputPath;
          imageSrcPath = imageSrcPath.endsWith('/') ? imageSrcPath.slice(0, -1) : imageSrcPath;
          readdir(imageSrcPath, (err, files) => {
            let images = files.filter((file) => file.match(/.jpg|.png|.jpeg/i));
            let $images = {};
            images.some(image => {
              console.log(image);
              $images[image] = build.generateImage(image);
              return ++counter > total;
            });
            forkJoin($images)
            .subscribe({
              next: (images) => {
                console.log(images)
                Object.keys(images).forEach((image) => {
                  let coord = images[image];
                  xmlOut = build.tokenReplace(xml, {folder: folder, label: label, filename: image, filepath: `${outputPath}/${image}`, width: imageSize.width, height: imageSize.height, xmin: coord.xmin, ymin: coord.ymin, xmax: coord.xmax, ymax: coord.ymax})
                  // console.log(xmlOut)
                  xmlName = image.replace(image.match(/\.[0-9a-z]+$/i)[0], '.xml')
                  console.log(xmlName)
                  writeFileSync(`${imagePath}/${xmlName}`, xmlOut);  
                })
              },
              complete: () => {
                console.log('here')
                observer.next();
                observer.complete();                    
              }
            })
          });
        })();  
      } else {
        console.log('--label, --image_source_path and --image_path are required');
        observer.next();
        observer.complete();
      }
    });
  },
  generateImage: (file) => {
    return new Observable((observer) => {
      let coord = {};
          let canvas = createCanvas(imageSize.width, imageSize.height);
          let ctx = canvas.getContext('2d');
          let ctxbg =  canvas.getContext('2d');
          const cwd = process.cwd()
          loadImage(`${cwd}/background-images/background_${Math.floor(Math.random()*10)}.jpg`)
          .then((background) => {
            ctxbg.drawImage(background, 0, 0, imageSize.width, imageSize.height);
            loadImage(`${imageSrcPath}/${file}`).then((img) => {
              // console.log(img, img.width)
              let offset = {x: imageSize.width - img.width, y: imageSize.height - img.height};
              coord.xmin = Math.floor(Math.random()*offset.x)
              coord.ymin = Math.floor(Math.random()*offset.y)
              ctx.drawImage(img, coord.xmin, coord.ymin, img.width, img.height);
              let ext = file.match(/.jpg|.png|.jpeg/i)[0].toLowerCase()
              const buffer = canvas.toBuffer(imageTypes[ext])
              writeFileSync(`${imagePath}/${file}`, buffer);
              coord.xmax = img.width + coord.xmin;
              coord.ymax = img.height + coord.ymin; 
              observer.next(coord);
              observer.complete();
            })
          }) 
    })  
  },
  tokenReplace: (template, obj) => {
    //  template = 'Where is ${movie} playing?',
    //  tokenReplace(template, {movie: movie});
    return template.replace(/\$\{([^\s\:\}]+)(?:\:([^\s\:\}]+))?\}/g, function(match, key) {
      return obj[key];
    });
  },
  exit: (msg) => {
    console.log(msg);
    process.exit(0);
  }
}

build[task]()
.subscribe(() => console.log('process completed.'));