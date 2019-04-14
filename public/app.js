
const printImages = {
	frontMatte: 'images/inside.png',
	frontGloss: 'images/inside-foil.png',
	backMatte: 'images/outside.png',
	backGloss: 'images/outside-foil.png',
	frontMatteFeel: 'images/inside-foil.png',
	frontGlossFeel: 'images/inside-foil.png',
	backMatteFeel: 'images/outside-foil.png',
	backGlossFeel: 'images/outside-foil.png'
};

const basePrintProperties = {
	roughness: 0, // 0 if matte, 1 if gloss (0-100% between 0 and 1)
	textureIntensity: 0
};

// https://threejs.org/examples/?q=standard#webgl_materials_variations_standard
const foilProperties = { 
	opacity: 0.9,
	emissiveIntensity: 1, // how much glow you want?
	emissive: '#FFFF00', // color of the glow
	metalness: 1, // how much shine you want?
	roughness: 0.5, // 0 if matte, 1 if gloss (0-100% between 0 and 1)
	textureIntensity: 1,
	clearCoat: 0,
	clearCoatRoughness: 0,
	reflectivity: 0
};

const lightProperties = {
	color: 0xFFFFFF,
	intensity: 3
};

const bg = {
	fogColor: 0x000000,
	bgColor: 0x000000, // optional. If used skybox is not set, this will be used. If this is not set, use css on the canvas or page
	skyboxBg: [ // this property is optional, and will default to the color. If used, specify all.
		'images/red00.jpg', // top: 
		'images/red00.jpg', // bottom: 
		'images/red00.jpg', // facing: 
		'images/red00.jpg', // left: 
		'images/red00.jpg', // right: 
		'images/red00.jpg' // behind: 
	]
};

// This is here so you can control the animation of the print flip, including timing.
const animatePrint = () => {
	const tl = new TimelineMax();
	tl.add(TweenMax.to(mainMesh.rotation, 4, {
		y: rads(180), 
		ease: Power2.easeInOut
	}));
	tl.add(TweenMax.to(mainMesh.rotation, 4, {
		y: rads(360), 
		ease: Power2.easeInOut, 
		delay: 4,
		onComplete: () => {
			setTimeout(()=>{ tl.restart(); }, 4000);
		}
	}));
};





// Browser driver support specifics
var canvas, context;

// Renderer specifics
var camera, scene, renderer, light;
var THREE = window.THREE || {};

const rads = (degrees) => {
	return THREE.Math.degToRad(degrees); //  * Math.PI / 180;
};

var boxRotationDims = {
	x: 0,
	y: 0
};

var pageCenterDims = {
	x: 0,
	y: 0,
	width: 0,
	height: 0
};

var visibleBounds = {
	width: 0,
	height: 0
};

var printDims2D = {
	width: 0,
	height: 0
};

const container = new THREE.Group();
let maxSamplingRes;

const getVisibleBounds = (depth, camera) => {
	const visibleHeightAtZDepth = ( depth, camera ) => {
		// compensate for cameras not positioned at z=0
		const cameraOffset = camera.position.z;
		if ( depth < cameraOffset ) depth -= cameraOffset;
		else depth += cameraOffset;
	  
		// vertical fov in radians
		const vFOV = camera.fov * Math.PI / 180; 
	  
		// Math.abs to ensure the result is always positive
		return 2 * Math.tan( vFOV / 2 ) * Math.abs( depth );
	};
	
	const visibleWidthAtZDepth = ( depth, camera ) => {
		const height = visibleHeightAtZDepth( depth, camera );
		return height * camera.aspect;
	};

	return {
		width: visibleWidthAtZDepth(depth, camera),
		height: visibleHeightAtZDepth(depth, camera)
	};
};

var mainMesh;

const start3d = () => {
	return new Promise((resolve, reject) => {
	
		var resizeThrottle;

		const onWinResize = () => {
			if(resizeThrottle) { clearTimeout(resizeThrottle); resizeThrottle = null; }
			resizeThrottle = setTimeout(()=>{
				renderer.setSize( window.innerWidth, window.innerHeight );
				camera.aspect = window.innerWidth / window.innerHeight;
				camera.updateProjectionMatrix();
			
			}, 100);
		}

		const aspect = window.innerWidth / window.innerHeight;

		// WebGL 2 looks to be supported in Chrome and FF, but not in Safari Tech Preview very well.
		canvas = document.createElement('canvas');
		canvas.style.background = '#000000';
		context = canvas.getContext('webgl2'); // webgl2 for that engine
		renderer = new THREE.WebGLRenderer({
			canvas: canvas,
			context: context,
			antialias: true
		});
		
		renderer.setSize(window.innerWidth, window.innerHeight);

		renderer.gammaFactor = 2.2;
		renderer.gammaOutput = true;

		maxSamplingRes = renderer.capabilities.getMaxAnisotropy();

		document.body.appendChild(renderer.domElement);
		
		loadImageBitmap(printImages.frontMatte).then(image => {
			printDims2D.width = image.width;
			printDims2D.height = image.height;
			const squareMin = Math.max(printDims2D.width, printDims2D.height);

			scene = new THREE.Scene();

			// PerspectiveCamera( fov : Number, aspect : Number, near : Number, far : Number )
			camera = new THREE.PerspectiveCamera(30, aspect, 0.01, squareMin*2); // 40

			visibleBounds = getVisibleBounds(30, camera);
			const visMin = Math.max(visibleBounds.width, visibleBounds.height);

			if (bg.skyboxBg) {
				const sb = bg.skyboxBg;
				const loader = new THREE.TextureLoader();
				const texture = loader.load(sb[0]);
				texture.encoding = THREE.sRGBEncoding;
				texture.anisotropy = 16;

				const refractionTexture = loader.load(sb[0]);
				refractionTexture.encoding = THREE.sRGBEncoding;
				refractionTexture.mapping = THREE.CubeRefractionMapping;
				refractionTexture.anisotropy = 16;

	//			scene.background = texture;
				console.log('box this big',squareMin);
				const geometry = new THREE.BoxBufferGeometry( squareMin, squareMin, squareMin );
				const material = new THREE.MeshStandardMaterial({
					map: texture,
					side: THREE.DoubleSide,

				});
				const cube = new THREE.Mesh( geometry, material );
				cube.frustumCulled = false;
				cube.position.set(0,0,0);
				scene.add( cube );
			} else if(bg.bgColor) {
				scene.background = new THREE.Color(bg.bgColor);
			} else {
				// background can be set by css
			}

			scene.matrixAutoUpdate = false;
	
	
			// camera.matrixAutoUpdate = false;

			// positioning a light above the camera
			light = new THREE.DirectionalLight(lightProperties.color, lightProperties.intensity);
			light.castShadow = true;
			scene.add(light);

			const targetObject = new THREE.Object3D();
			scene.add(targetObject);

			light.target = targetObject;

			const globalLight = new THREE.AmbientLight( lightProperties.color, 0.5 ); // soft white light
			scene.add( globalLight );

			window.addEventListener('resize', onWinResize);
			onWinResize();	

			console.log('them dims', printDims2D);
			mainMesh = makeScene(printImages);
			console.log('mesh is returned to add to scene', mainMesh);
			scene.add(mainMesh);
			resolve();
		});
	});
};


const loadImageBitmap = (path, options) => {
	return new Promise((resolve, reject) => {
		var loader = new THREE.ImageBitmapLoader();

		//ex: imageOrientation: 'flipY' 
		if (options) { loader.setOptions(options); }
	
		loader.load(
			path,
			imageBitmap => { console.log('loaded', path, imageBitmap); setTimeout(resolve, 0, imageBitmap); },
			()=>{ console.log('progress', path); },
			err => { console.log('error', path, err); reject(err); }
		);
	});
};

const matteImageMaterial = (texture, feel) => {
	// const texture = new THREE.CanvasTexture(imageBitmap);
	// texture.needsUpdate = false;
	// texture.matrixAutoUpdate = false;
	return new THREE.MeshPhysicalMaterial({
		map: texture,
		side: THREE.FrontSide,
		roughness: basePrintProperties.roughness,
		bumpMap: feel,
//		bumpMapScale: basePrintProperties.textureIntensity
	});
};

const metallicImageMaterial = (texture, feel) => {
	const color3d = new THREE.Color(foilProperties.emissive);
	return new THREE.MeshPhysicalMaterial({
		transparent: true,
		opacity: foilProperties.opacity,
		roughness: foilProperties.roughness,
		alphaMap: texture,
		emissiveIntensity: foilProperties.emissiveIntensity,
		emissive: color3d,
		emissiveMap: texture,
		metalness: foilProperties.metalness,
		metalnessMap: texture,
		side: THREE.FrontSide,
		bumpMap: feel,
//		bumpMapScale: foilProperties.textureIntensity,
		clearCoat: foilProperties.clearCoat,
		clearCoatRoughness: foilProperties.clearCoatRoughness,
		reflectivity: foilProperties.reflectivity
	});
};

const makePrintContainer = (dims, fontMatteMaterial, frontMetallicMaterial, backMatteMaterial, backMetallicMaterial) => {
	
	const imageScale = visibleBounds.width / window.innerWidth;

	const baseZ = dims.width * imageScale;

	camera.position.z = baseZ * 2;

	light.position.set(baseZ/2, baseZ/2, baseZ + 5);
	light.target.position.set((baseZ/2) * -1, (baseZ/2) * -1, 0);

	if (bg.bgColor && !bg.skyboxBg) {
		scene.fog = new THREE.Fog(new THREE.Color(bg.fogColor), baseZ * 2, baseZ * 2.5);
	}

	console.log('camera positioned at', camera.position.z);
	console.log('fog positioned from', baseZ * 2, 'to', baseZ * 2.5);
	console.log('light positioned at', baseZ+5);

	const printGeometry = new THREE.PlaneBufferGeometry(dims.width * imageScale, dims.height * imageScale, 1, 1);

	const frontMatteMesh = new THREE.Mesh( 
		printGeometry, 
		fontMatteMaterial
	);
	frontMatteMesh.position.z = 0.01;
	frontMatteMesh.matrixWorldNeedsUpdate = false;
	frontMatteMesh.matrixAutoUpdate = false;
	frontMatteMesh.frustumCulled = false;
	frontMatteMesh.updateMatrix();

	const frontMetallicMesh = new THREE.Mesh( 
		printGeometry, 
		frontMetallicMaterial
	);
	frontMetallicMesh.position.z = 0.02;
	frontMetallicMesh.matrixWorldNeedsUpdate = false;
	frontMetallicMesh.matrixAutoUpdate = false;
	frontMetallicMesh.frustumCulled = false;
	frontMetallicMesh.updateMatrix();

	const backMatteMesh = new THREE.Mesh( 
		printGeometry, 
		backMatteMaterial
	);
	backMatteMesh.position.z = -0.01;
	backMatteMesh.rotation.y = rads(180) * -1;
	// backMatteMesh.rotation.x = rads(180);
	backMatteMesh.matrixWorldNeedsUpdate = false;
	backMatteMesh.matrixAutoUpdate = false;
	backMatteMesh.frustumCulled = false;
	backMatteMesh.updateMatrix();

	const backMetallicMesh = new THREE.Mesh( 
		printGeometry, 
		backMetallicMaterial
	);
	backMetallicMesh.position.z = -0.02;
	backMetallicMesh.rotation.y = rads(180) * -1;
	// backMetallicMesh.rotation.x = rads(180);
	backMetallicMesh.matrixWorldNeedsUpdate = false;
	backMetallicMesh.matrixAutoUpdate = false;
	backMetallicMesh.frustumCulled = false;
	backMetallicMesh.updateMatrix();
	// container was created here. hit a bug. bailed. out of time

	container.add(frontMatteMesh);
	container.add(frontMetallicMesh);
	container.add(backMatteMesh);
	container.add(backMetallicMesh);

	return container;
};


const makeScene = (images) => {
	const loader = new THREE.TextureLoader();
	let frontMatte = loader.load(images.frontMatte),
		frontGloss = loader.load(images.frontGloss),
		backMatte = loader.load(images.backMatte),
		backGloss = loader.load(images.backGloss),
		frontMatteFeel = loader.load(images.frontMatteFeel),
		frontGlossFeel = loader.load(images.frontGlossFeel),
		backMatteFeel = loader.load(images.backMatteFeel),
		backGlossFeel = loader.load(images.backGlossFeel);

	// set the "color space" of the texture
	frontMatte.encoding = THREE.sRGBEncoding;
	frontGloss.encoding = THREE.sRGBEncoding;
	backMatte.encoding = THREE.sRGBEncoding;
	backGloss.encoding = THREE.sRGBEncoding;
	frontMatteFeel.encoding = THREE.sRGBEncoding;
	frontGlossFeel.encoding = THREE.sRGBEncoding;
	backMatteFeel.encoding = THREE.sRGBEncoding;
	backGlossFeel.encoding = THREE.sRGBEncoding;

	// reduce blurring at glancing angles
	frontMatte.anisotropy = 16;
	frontGloss.anisotropy = 16;
	backMatte.anisotropy = 16;
	backGloss.anisotropy = 16;
	frontMatteFeel.anisotropy = 16;
	frontGlossFeel.anisotropy = 16;
	backMatteFeel.anisotropy = 16;
	backGlossFeel.anisotropy = 16;

	const container = makePrintContainer(
		{width: printDims2D.width, height: printDims2D.height}, 
		matteImageMaterial(frontMatte, frontMatteFeel), 
		metallicImageMaterial(frontGloss, frontGlossFeel), 
		matteImageMaterial(backMatte, backMatteFeel), 
		metallicImageMaterial(backGloss, backGlossFeel)
	);
	console.log('should be a container',container);
	return container;
};

const render = () => {
	renderer.render(scene, camera);
};


const animate = () => {
	render();
	requestAnimationFrame(animate);
};

const run = () => {
	start3d().then(() => {
		animatePrint();
		animate();
	});
};

// yeild the thread so chrome doesn't nerf the raf
setTimeout(run, 0);