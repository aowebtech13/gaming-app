// Loading Screen Management
let loadingProgress = 0;
let loadingMessages = [
  __("chatroom.loading.starting_world"),
  __("chatroom.loading.loading_characters"),
  __("chatroom.loading.setting_up_profile"),
  __("chatroom.loading.preparing_3d"),
  __("chatroom.loading.setting_up_camera"),
  __("chatroom.loading.creating_3d"),
  __("chatroom.loading.setting_up_lighting"),
  __("chatroom.loading.connecting_to_server"),
  __("chatroom.loading.finalizing_setup"),
  __("chatroom.loading.welcome_to_world")
];
let currentMessageIndex = 0;

// Initialize loading screen immediately
document.addEventListener('DOMContentLoaded', function() {
  // Show loading screen immediately with first message
  updateLoadingProgress(5, __("chatroom.loading.starting_world"));
});

function updateLoadingProgress(progress, message = null) {
  const progressFill = document.getElementById('loadingProgressFill');
  const percentageText = document.getElementById('loadingPercentage');
  const messageText = document.getElementById('loadingMessage');
  
  if (progressFill) {
    progressFill.style.width = `${progress}%`;
  }
  
  if (percentageText) {
    percentageText.textContent = `${Math.round(progress)}%`;
  }
  
  if (message && messageText) {
    messageText.style.animation = 'none';
    messageText.offsetHeight; // Trigger reflow
    messageText.style.animation = 'fadeInOut 1s ease-in-out';
    messageText.textContent = message;
  }
  
  loadingProgress = progress;
}

function showNextLoadingMessage() {
  if (currentMessageIndex < loadingMessages.length) {
    updateLoadingProgress(loadingProgress, loadingMessages[currentMessageIndex]);
    currentMessageIndex++;
  }
}

function hideLoadingScreen() {
  const loadingScreen = document.getElementById('loadingScreen');
  if (loadingScreen) {
    loadingScreen.classList.add('fade-out');
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 500);
  }
}

// Socket connection with authentication - will be initialized after getting user data
let socket;
let types = []; // Will be dynamically loaded

// Global variables for user data and chatroom state
let userProfile = null;
let chatroomData = null;
let name = '';
let charType = 'Fighter';
let lastCoordinateSave = 0;
const COORDINATE_SAVE_INTERVAL = 5000; // Save coordinates every 5 seconds

// 3D Chatroom Environment Creator
function createMedievalJapaneseEnvironment(scene) {
  createChatroomEnvironment(scene);
}

// Global collision system
const collisionObjects = [];
const mapRadius = 45; // Slightly smaller than the ground radius

// Rank color scheme for badges
function getRankColor(level) {
  if (level >= 20) return '#8B5CF6'; // Purple for max rank
  if (level >= 15) return '#F59E0B'; // Orange for high rank
  if (level >= 10) return '#EF4444'; // Red for medium-high rank
  if (level >= 5) return '#10B981';  // Green for medium rank
  return '#3B82F6'; // Blue for low rank
}

// Collision detection functions
function addCollisionCircle(x, z, radius) {
  collisionObjects.push({ type: 'circle', x, z, radius });
}

function addCollisionRect(x, z, width, height) {
  collisionObjects.push({ type: 'rect', x, z, width, height });
}

function checkCollision(newX, newZ, playerRadius = 1) {
  // Check map boundaries (circular)
  const distanceFromCenter = Math.sqrt(newX * newX + newZ * newZ);
  if (distanceFromCenter + playerRadius > mapRadius) {
    return true; // Collision with boundary
  }
  
  // Check collision with objects
  for (const obj of collisionObjects) {
    if (obj.type === 'circle') {
      const dx = newX - obj.x;
      const dz = newZ - obj.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance < obj.radius + playerRadius) {
        return true; // Collision detected
      }
    } else if (obj.type === 'rect') {
      const halfWidth = obj.width / 2;
      const halfHeight = obj.height / 2;
      if (newX + playerRadius > obj.x - halfWidth &&
          newX - playerRadius < obj.x + halfWidth &&
          newZ + playerRadius > obj.z - halfHeight &&
          newZ - playerRadius < obj.z + halfHeight) {
        return true; // Collision detected
      }
    }
  }
  
  return false; // No collision
}

function createSkyEnvironment(scene) {
  // Create sky dome
  const skyGeo = new THREE.SphereGeometry(200, 32, 32);
  const skyMat = new THREE.MeshBasicMaterial({ 
    color: 0x87CEEB, // Sky blue
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.8
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // Create sun
  const sunGeo = new THREE.SphereGeometry(5, 16, 16);
  const sunMat = new THREE.MeshBasicMaterial({ 
    color: 0xFFD700, // Gold
    emissive: 0xFFD700,
    emissiveIntensity: 0.5
  });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  sun.position.set(80, 60, -40);
  scene.add(sun);

  // Mountains removed per user request
  
  // Create clouds
  createClouds(scene);
}


function createClouds(scene) {
  // Create various cloud formations
  const cloudData = [
    { x: -60, y: 45, z: -80, scale: 1.2 },
    { x: -30, y: 50, z: -70, scale: 0.8 },
    { x: 0, y: 55, z: -75, scale: 1.5 },
    { x: 40, y: 48, z: -65, scale: 1.0 },
    { x: 70, y: 52, z: -85, scale: 1.3 },
    { x: -40, y: 42, z: 60, scale: 0.9 },
    { x: 20, y: 58, z: 70, scale: 1.1 },
    { x: 60, y: 46, z: 65, scale: 0.7 },
    { x: -90, y: 40, z: -20, scale: 1.4 },
    { x: 90, y: 44, z: 30, scale: 1.0 },
    { x: -20, y: 62, z: 40, scale: 0.6 },
    { x: 10, y: 38, z: -90, scale: 1.2 }
  ];

  cloudData.forEach(cloud => {
    createCloud(scene, cloud.x, cloud.y, cloud.z, cloud.scale);
  });
}

function createCloud(scene, x, y, z, scale = 1) {
  const cloudGroup = new THREE.Group();
  
  // Create cloud using multiple spheres for fluffy appearance
  const cloudSpheres = [
    { x: 0, y: 0, z: 0, scale: 1.0 },
    { x: -2, y: 0.5, z: 1, scale: 0.8 },
    { x: 2, y: -0.2, z: -1, scale: 0.9 },
    { x: 1, y: 0.8, z: 2, scale: 0.7 },
    { x: -1.5, y: -0.5, z: -2, scale: 0.6 },
    { x: 0.5, y: 1.2, z: 0, scale: 0.5 }
  ];

  cloudSpheres.forEach(sphere => {
    const sphereGeo = new THREE.SphereGeometry(3 * sphere.scale, 12, 12);
    const sphereMat = new THREE.MeshLambertMaterial({ 
      color: 0xFFFFFF, // White
      transparent: true,
      opacity: 0.8
    });
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    sphereMesh.position.set(sphere.x * scale, sphere.y * scale, sphere.z * scale);
    cloudGroup.add(sphereMesh);
  });

  cloudGroup.position.set(x, y, z);
  cloudGroup.scale.multiplyScalar(scale);
  scene.add(cloudGroup);
}

function createChatroomEnvironment(scene) {
  // Clear previous collision objects
  collisionObjects.length = 0;
  
  // Create sky environment with clouds, sun, and mountains
  createSkyEnvironment(scene);
  
  // Create main ground
  const groundGeo = new THREE.CircleGeometry(50, 32);
  const groundMat = new THREE.MeshLambertMaterial({ 
    color: 0x7B8D6B, // Sage green
    transparent: true,
    opacity: 0.9
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Central plaza area
  const plazaGeo = new THREE.CircleGeometry(15, 16);
  const plazaMat = new THREE.MeshLambertMaterial({ color: 0xC4A484 }); // Light brown
  const plaza = new THREE.Mesh(plazaGeo, plazaMat);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.01;
  scene.add(plaza);

  // Create pathways
  createChatroomPaths(scene);
  
  // Add architectural elements
  createChatroomBuildings(scene);
  
  // Add decorative elements
  createChatroomDecor(scene);
}

function createChatroomPaths(scene) {
  // Four main paths radiating from center
  const pathMat = new THREE.MeshLambertMaterial({ color: 0x8B8680 }); // Stone gray
  
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const pathGeo = new THREE.PlaneGeometry(3, 25);
    const path = new THREE.Mesh(pathGeo, pathMat);
    path.rotation.x = -Math.PI / 2;
    path.rotation.z = angle;
    path.position.set(
      Math.cos(angle) * 20,
      0.005,
      Math.sin(angle) * 20
    );
    scene.add(path);
  }
}

function createChatroomBuildings(scene) {
  // Corner pavilions for gathering
  const pavilionPositions = [
    { x: -25, z: -25 }, { x: 25, z: -25 },
    { x: -25, z: 25 }, { x: 25, z: 25 }
  ];
  
  pavilionPositions.forEach(pos => {
    createPavilion(scene, pos.x, pos.z);
  });
  
  // Central fountain
  createFountain(scene);
}

function createPavilion(scene, x, z) {
  // Base platform
  const baseGeo = new THREE.CylinderGeometry(6, 6, 0.5);
  const baseMat = new THREE.MeshLambertMaterial({ color: 0xD2B48C }); // Tan
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.set(x, 0.25, z);
  scene.add(base);
  
  // Pillars
  const pillarGeo = new THREE.CylinderGeometry(0.3, 0.3, 6);
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0xF5F5DC }); // Beige
  
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI * 2) / 6;
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(
      x + Math.cos(angle) * 4,
      3.5,
      z + Math.sin(angle) * 4
    );
    scene.add(pillar);
    
    // Add collision for each pillar
    addCollisionCircle(x + Math.cos(angle) * 4, z + Math.sin(angle) * 4, 0.5);
  }
  
  // Roof
  const roofGeo = new THREE.ConeGeometry(7, 3, 8);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x654321 }); // Dark brown
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(x, 8, z);
  scene.add(roof);
  
  // Add collision area for the pavilion center (smaller radius to allow walking around pillars)
  addCollisionCircle(x, z, 2);
}

function createFountain(scene) {
  // Fountain base
  const fountainBaseGeo = new THREE.CylinderGeometry(4, 4, 1);
  const fountainBaseMat = new THREE.MeshLambertMaterial({ color: 0x708090 }); // Slate gray
  const fountainBase = new THREE.Mesh(fountainBaseGeo, fountainBaseMat);
  fountainBase.position.set(0, 0.5, 0);
  scene.add(fountainBase);
  
  // Water basin
  const basinGeo = new THREE.CylinderGeometry(3.5, 3.5, 0.2);
  const basinMat = new THREE.MeshLambertMaterial({ 
    color: 0x4682B4, // Steel blue
    transparent: true,
    opacity: 0.7
  });
  const basin = new THREE.Mesh(basinGeo, basinMat);
  basin.position.set(0, 1.1, 0);
  scene.add(basin);
  
  // Central pillar
  const pillarGeo = new THREE.CylinderGeometry(0.5, 0.5, 2);
  const pillar = new THREE.Mesh(pillarGeo, fountainBaseMat);
  pillar.position.set(0, 2, 0);
  scene.add(pillar);
  
  // Add collision for the fountain
  addCollisionCircle(0, 0, 4.5);
}


function createChatroomDecor(scene) {
  // Trees around the perimeter
  const treePositions = [
    { x: -35, z: 0 }, { x: 35, z: 0 }, { x: 0, z: -35 }, { x: 0, z: 35 },
    { x: -30, z: -30 }, { x: 30, z: -30 }, { x: -30, z: 30 }, { x: 30, z: 30 }
  ];
  
  treePositions.forEach(pos => {
    createTree(scene, pos.x, pos.z);
  });
  
  // Lamp posts for lighting
  const lampPositions = [
    { x: -10, z: -10 }, { x: 10, z: -10 },
    { x: -10, z: 10 }, { x: 10, z: 10 }
  ];
  
  lampPositions.forEach(pos => {
    createLampPost(scene, pos.x, pos.z);
  });
  
  // Bushes scattered around the environment
  const bushPositions = [
    { x: -20, z: -15, scale: 1.0 }, { x: 22, z: -18, scale: 0.8 },
    { x: -15, z: 20, scale: 1.2 }, { x: 18, z: 22, scale: 0.9 },
    { x: -8, z: -25, scale: 0.7 }, { x: 12, z: -28, scale: 1.1 },
    { x: -28, z: 8, scale: 0.9 }, { x: 25, z: 12, scale: 1.0 },
    { x: -32, z: -12, scale: 0.8 }, { x: 28, z: -8, scale: 1.3 },
    { x: -12, z: 32, scale: 1.0 }, { x: 15, z: 35, scale: 0.9 },
    { x: 6, z: -20, scale: 0.6 }, { x: -18, z: 25, scale: 1.1 }
  ];
  
  bushPositions.forEach(pos => {
    createBush(scene, pos.x, pos.z, pos.scale);
  });
  
  // Flower patches for color and beauty
  const flowerPatches = [
    { x: -12, z: -8, type: 'red' }, { x: 8, z: -12, type: 'yellow' },
    { x: -6, z: 14, type: 'purple' }, { x: 14, z: 8, type: 'pink' },
    { x: -16, z: 6, type: 'blue' }, { x: 6, z: -16, type: 'orange' },
    { x: 16, z: -6, type: 'red' }, { x: -8, z: 18, type: 'yellow' },
    { x: 20, z: 16, type: 'purple' }, { x: -22, z: -20, type: 'pink' },
    { x: 24, z: -22, type: 'blue' }, { x: -26, z: 18, type: 'orange' }
  ];
  
  flowerPatches.forEach(patch => {
    createFlowerPatch(scene, patch.x, patch.z, patch.type);
  });
}

function createTree(scene, x, z) {
  // Tree trunk
  const trunkGeo = new THREE.CylinderGeometry(0.8, 1, 8);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Saddle brown
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.set(x, 4, z);
  scene.add(trunk);
  
  // Tree canopy
  const canopyGeo = new THREE.SphereGeometry(5, 12, 8);
  const canopyMat = new THREE.MeshLambertMaterial({ color: 0x228B22 }); // Forest green
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.set(x, 10, z);
  scene.add(canopy);
  
  // Add collision for tree trunk
  addCollisionCircle(x, z, 1.5);
}

function createLampPost(scene, x, z) {
  // Post
  const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 4);
  const postMat = new THREE.MeshLambertMaterial({ color: 0x2F2F2F }); // Dark gray
  const post = new THREE.Mesh(postGeo, postMat);
  post.position.set(x, 2, z);
  scene.add(post);
  
  // Lamp
  const lampGeo = new THREE.SphereGeometry(0.5, 8, 6);
  const lampMat = new THREE.MeshLambertMaterial({ 
    color: 0xFFFACD, // Light goldenrod
    emissive: 0x221100,
    emissiveIntensity: 0.3
  });
  const lamp = new THREE.Mesh(lampGeo, lampMat);
  lamp.position.set(x, 4.5, z);
  scene.add(lamp);
  
  // Add point light
  const light = new THREE.PointLight(0xFFFACD, 0.5, 20);
  light.position.set(x, 4.5, z);
  scene.add(light);
  
  // Add collision for lamp post
  addCollisionCircle(x, z, 0.3);
}

function createBush(scene, x, z, scale = 1) {
  // Create a bush using multiple spheres for a natural, bushy appearance
  const bushGroup = new THREE.Group();
  
  const bushSpheres = [
    { x: 0, y: 0, z: 0, scale: 1.0 },
    { x: -0.8, y: 0.2, z: 0.6, scale: 0.7 },
    { x: 0.9, y: -0.1, z: -0.4, scale: 0.8 },
    { x: 0.3, y: 0.4, z: 0.8, scale: 0.6 },
    { x: -0.6, y: -0.2, z: -0.9, scale: 0.5 },
    { x: 0.7, y: 0.3, z: 0.2, scale: 0.7 }
  ];

  bushSpheres.forEach(sphere => {
    const sphereGeo = new THREE.SphereGeometry(1.2 * sphere.scale, 8, 6);
    const bushMat = new THREE.MeshLambertMaterial({ 
      color: 0x228B22, // Forest green
      transparent: true,
      opacity: 0.9
    });
    const sphereMesh = new THREE.Mesh(sphereGeo, bushMat);
    sphereMesh.position.set(
      sphere.x * scale, 
      0.8 + sphere.y * scale, 
      sphere.z * scale
    );
    bushGroup.add(sphereMesh);
  });

  bushGroup.position.set(x, 0, z);
  bushGroup.scale.multiplyScalar(scale);
  scene.add(bushGroup);
  
  // Add small collision for bush
  addCollisionCircle(x, z, 1.2 * scale);
}

function createFlowerPatch(scene, x, z, type = 'red') {
  // Define flower colors
  const flowerColors = {
    red: 0xFF6B6B,
    yellow: 0xFFD93D,
    purple: 0x9B59B6,
    pink: 0xFF69B4,
    blue: 0x3498DB,
    orange: 0xFF8C42
  };
  
  const flowerColor = flowerColors[type] || flowerColors.red;
  
  // Create a small patch of flowers
  for (let i = 0; i < 8; i++) {
    // Random position within a small area
    const offsetX = (Math.random() - 0.5) * 3;
    const offsetZ = (Math.random() - 0.5) * 3;
    
    // Flower stem
    const stemGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.4);
    const stemMat = new THREE.MeshLambertMaterial({ color: 0x228B22 }); // Green
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(x + offsetX, 0.2, z + offsetZ);
    scene.add(stem);
    
    // Flower head
    const flowerGeo = new THREE.SphereGeometry(0.15, 6, 4);
    const flowerMat = new THREE.MeshLambertMaterial({ 
      color: flowerColor,
      emissive: flowerColor,
      emissiveIntensity: 0.1
    });
    const flower = new THREE.Mesh(flowerGeo, flowerMat);
    flower.position.set(x + offsetX, 0.45, z + offsetZ);
    scene.add(flower);
    
    // Small leaves
    for (let j = 0; j < 2; j++) {
      const leafGeo = new THREE.SphereGeometry(0.08, 4, 3);
      const leafMat = new THREE.MeshLambertMaterial({ color: 0x32CD32 }); // Lime green
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(
        x + offsetX + (Math.random() - 0.5) * 0.3,
        0.15 + Math.random() * 0.1,
        z + offsetZ + (Math.random() - 0.5) * 0.3
      );
      leaf.scale.set(1, 0.3, 1); // Flatten to look like leaves
      scene.add(leaf);
    }
  }
  
  // No collision for flowers as they're small and decorative
}

// Character configurations cache
const characterConfigs = {};

// Load available character types from server
function loadAvailableCharacterTypes() {
  return new Promise((resolve) => {
    $.ajax({
      url: '/chatroom/characters-list',
      method: 'GET',
      dataType: 'json'
    })
    .done(function(data) {
      if (data.status === 200 && Array.isArray(data.data)) {
        types = data.data;
        console.log('Loaded available character types:', types);
        resolve(types);
        return;
      }
      
      // Fallback: try to load each known character and see which ones exist
      const knownTypes = ['Fighter', 'Ninja', 'Samurai'];
      const availableTypes = [];
      let completedRequests = 0;
      
      knownTypes.forEach(type => {
        $.ajax({
          url: `/chatroom/characters/${type}/character.json`,
          method: 'GET',
          dataType: 'json'
        })
        .done(function() {
          availableTypes.push(type);
        })
        .fail(function(xhr, status, error) {
          console.log(`Character ${type} not available:`, error);
        })
        .always(function() {
          completedRequests++;
          if (completedRequests === knownTypes.length) {
            types = availableTypes.length > 0 ? availableTypes : ['Fighter'];
            console.log('Fallback character types loaded:', types);
            resolve(types);
          }
        });
      });
    })
    .fail(function(xhr, status, error) {
      console.error('Error loading character types:', error);
      // Final fallback
      types = ['Fighter'];
      resolve(types);
    });
  });
}

// Load character configuration from JSON
function loadCharacterConfig(characterName) {
  return new Promise((resolve) => {
    if (characterConfigs[characterName]) {
      resolve(characterConfigs[characterName]);
      return;
    }
    
    $.ajax({
      url: `/chatroom/characters/${characterName}/character.json`,
      method: 'GET',
      dataType: 'json'
    })
    .done(function(config) {
      characterConfigs[characterName] = config;
      console.log(`Loaded character config for ${characterName}:`, config);
      resolve(config);
    })
    .fail(function(xhr, status, error) {
      console.error(`Error loading character config for ${characterName}:`, error);
      // Fallback to basic configuration
      resolve(getFallbackCharacterConfig(characterName));
    });
  });
}

// Fallback character configuration (backward compatibility)
function getFallbackCharacterConfig(characterName) {
  const fallbackConfig = {
    info: {
      name: characterName,
      displayName: characterName,
      description: `A ${characterName.toLowerCase()} character.`
    },
    display: {
      scale: { x: 2, y: 2, z: 1 },
      spriteHeight: 2,
      pixelPerfect: true,
      alphaTest: 0.1
    },
    animations: {
      frameRate: 80,
      defaultAnimation: "Idle",
      states: {
        Idle: { type: 'sheet', file: 'Idle.png', frames: 6, duration: 480, loop: true, priority: 0 },
        Idle_Left: { type: 'sheet', file: 'Idle_Left.png', frames: 6, duration: 480, loop: true, priority: 0 },
        Walk: { type: 'sheet', file: 'Walk.png', frames: 8, duration: 640, loop: true, priority: 1 },
        Walk_Left: { type: 'sheet', file: 'Walk_Left.png', frames: 8, duration: 640, loop: true, priority: 1 },
        Run: { type: 'sheet', file: 'Run.png', frames: 8, duration: 640, loop: true, priority: 2 },
        Run_Left: { type: 'sheet', file: 'Run_Left.png', frames: 8, duration: 640, loop: true, priority: 2 },
        Attack_1: { type: 'sheet', file: 'Attack_1.png', frames: 3, duration: 600, loop: false, priority: 10, returnTo: 'Idle' },
        Attack_1_Left: { type: 'sheet', file: 'Attack_1_Left.png', frames: 3, duration: 600, loop: false, priority: 10, returnTo: 'Idle_Left' },
        Attack_2: { type: 'sheet', file: 'Attack_2.png', frames: 4, duration: 700, loop: false, priority: 10, returnTo: 'Idle' },
        Attack_2_Left: { type: 'sheet', file: 'Attack_2_Left.png', frames: 4, duration: 700, loop: false, priority: 10, returnTo: 'Idle_Left' },
        Attack_3: { type: 'sheet', file: 'Attack_3.png', frames: 4, duration: 600, loop: false, priority: 10, returnTo: 'Idle' },
        Attack_3_Left: { type: 'sheet', file: 'Attack_3_Left.png', frames: 4, duration: 600, loop: false, priority: 10, returnTo: 'Idle_Left' },
        Shield: { type: 'sheet', file: 'Shield.png', frames: 2, duration: 500, loop: false, priority: 8, returnTo: 'Idle' },
        Shield_Left: { type: 'sheet', file: 'Shield_Left.png', frames: 2, duration: 500, loop: false, priority: 8, returnTo: 'Idle_Left' },
        Jump: { type: 'sheet', file: 'Jump.png', frames: 10, duration: 900, loop: false, priority: 5, returnTo: 'Idle' },
        Jump_Left: { type: 'sheet', file: 'Jump_Left.png', frames: 10, duration: 900, loop: false, priority: 5, returnTo: 'Idle_Left' },
        Hurt: { type: 'sheet', file: 'Hurt.png', frames: 3, duration: 400, loop: false, priority: 15, returnTo: 'Idle' },
        Hurt_Left: { type: 'sheet', file: 'Hurt_Left.png', frames: 3, duration: 400, loop: false, priority: 15, returnTo: 'Idle_Left' },
        Dead: { type: 'sheet', file: 'Dead.png', frames: 3, duration: 1000, loop: false, priority: 20, returnTo: null },
        Dead_Left: { type: 'sheet', file: 'Dead_Left.png', frames: 3, duration: 1000, loop: false, priority: 20, returnTo: null }
      }
    }
  };
  
  console.warn(`Using fallback configuration for ${characterName}`);
  characterConfigs[characterName] = fallbackConfig;
  return fallbackConfig;
}

// Fetch user profile data from server
async function fetchUserProfile() {
  try {
    const data = await $.get('/requests/user-profile');
    
    if (data.status === 200) {
      return data.data;
    } else {
      console.error('Failed to fetch user profile:', data.message);
      return null;
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

// Fetch chatroom data for authenticated user
async function fetchChatroomData() {
  try {
    const data = await $.get('/chatroom/data');
    if (data.status === 200) {
      return data.data;
    } else {
      console.error('Failed to fetch chatroom data:', data.message);
      return null;
    }
  } catch (error) {
    console.error('Error fetching chatroom data:', error);
    return null;
  }
}

// Save character selection to database
async function saveCharacterSelection(character) {
  try {
    const data = await $.post('/chatroom/update-character', {
      character: character
    });
    return data.status === 200;
  } catch (error) {
    console.error('Error saving character:', error);
    return false;
  }
}

// Save user coordinates to database
async function saveCoordinates(x, z) {
  const now = Date.now();
  if (now - lastCoordinateSave < COORDINATE_SAVE_INTERVAL) {
    return; // Don't save too frequently
  }
  
  lastCoordinateSave = now;
  
  try {
    await $.post('/chatroom/save-coordinates', {
      x: x,
      z: z
    });
  } catch (error) {
    console.error('Error saving coordinates:', error);
  }
}

function setupPlayerForm() {
  const $modal = $('#playerSetupModal');
  const $form = $('#playerSetupForm');
  const $charTypeSelect = $('#charType');
  const $userProfileInfo = $('#userProfileInfo');
  const $modalTitle = $('#modalTitle');
  const $modalDescription = $('#modalDescription');
  const $submitButton = $('#submitButton');

  // Modal is already hidden in HTML with 'hidden' class

  return new Promise(async (resolve) => {
    // Load available character types first
    console.log('Loading available character types...');
    await loadAvailableCharacterTypes();
    
    // Dynamically populate character options from types array
    $charTypeSelect.html(types.map(t => `<option value="${t}">${t}</option>`).join(''));
    
    // Fetch user profile and chatroom data
    console.log('Fetching user profile...');
    userProfile = await fetchUserProfile();
    console.log('User profile result:', userProfile);
    
    console.log('Fetching chatroom data...');
    chatroomData = await fetchChatroomData();
    console.log('Chatroom data result:', chatroomData);
    
    if (userProfile) {
      // User is authenticated - set name from profile
      name = userProfile.username;
      
      // Check if user already has a character selected BEFORE showing modal
      if (chatroomData && chatroomData.hasCharacter) {
        // User has character, set it and skip modal entirely
        charType = chatroomData.character;
        resolve();
        return;
      }
      
      // User needs to select character - now show and populate modal
      // Show user profile info
      $userProfileInfo.attr('class', 'bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-4 text-sm');
      $userProfileInfo.html(`
        <div class="flex items-center space-x-3">
          <img src="${userProfile.avatarUrl}" alt="Avatar" class="w-10 h-10 rounded-full">
          <div>
            <div class="font-semibold text-gray-900 dark:text-white">${userProfile.username}</div>
            <div class="text-gray-600 dark:text-gray-300">${userProfile.rankTitle}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">${userProfile.expPoints} EXP</div>
          </div>
        </div>
        <div class="mt-2 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
          <div class="bg-blue-600 dark:bg-blue-500 h-2 rounded-full" style="width: ${userProfile.expProgress.percentage}%"></div>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          ${userProfile.expProgress.current}/${userProfile.expProgress.required} EXP to next rank
        </div>
      `);
      
      // User needs to select character
      $modalTitle.text(__('chatroom.select_character_title'));
      $modalDescription.text(__('chatroom.choose_character'));
      $submitButton.text(__('chatroom.save_character'));
      
      // Now show the modal
      $modal.removeClass('hidden');
      
    } else {
      // User not authenticated - show login modal
      console.log('No user profile found, showing login modal');
      $('#playerSetupModal').addClass('hidden');
      $('#loginRequiredModal').removeClass('hidden');
      return;
    }
    
    $form.on('submit', async (e) => {
      e.preventDefault();
      charType = $charTypeSelect.val();
      
      // Save character selection for authenticated users
      if (userProfile) {
        const saved = await saveCharacterSelection(charType);
        if (!saved) {
          console.error('Failed to save character selection');
          // Continue anyway, but user will need to select again next time
        }
      }
      
      $modal.addClass('hidden');
      resolve();
    });
    
    // Focus on character select
    $charTypeSelect.focus();
  });
}

(async function init() {
  // Start loading screen immediately at page load
  updateLoadingProgress(5, __("chatroom.loading.starting_world"));
  
  // Simulate initial loading steps
  setTimeout(() => updateLoadingProgress(15, __("chatroom.loading.loading_characters")), 100);
  
  await setupPlayerForm();
  updateLoadingProgress(35, __("chatroom.loading.setting_up_profile"));
  
  if (!types.includes(charType)) charType = types[0];
  
  updateLoadingProgress(45, __("chatroom.loading.preparing_3d"));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.style.position = 'fixed';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left = '0';
  renderer.domElement.style.zIndex = '0';
  document.body.appendChild(renderer.domElement);
  
  updateLoadingProgress(55, __("chatroom.loading.setting_up_camera"));

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const overlay = $('#overlay')[0];
  const chatInput = $('#chatInput')[0];

  const players = {};
  const chatBubbles = {};
  
  // Expose players object and functions globally for modal access
  window.players = players;
  window.getRankColor = getRankColor;

  const velocity = { x: 0, z: 0 };
  const walkSpeed = 3;  // Reduced walking speed
  const runSpeed = 5;   // Original speed for running
  let lastTime = performance.now();
  let lastDirection = 1; // 1 = right, -1 = left
  let lastAnimDirection = 1; // Track last anim direction for state
  let isRunning = false; // Track if running (shift key held)

  // Add special animation lock
  let animLockUntil = 0;
  let animLockState = null;
  let animationStopped = false;
  
  // Function to broadcast immediate animation state changes
  function broadcastAnimationState() {
    if (socket && socket.connected) {
      const currentAnimState = isRunning ? 'Run' : 'Walk';
      socket.emit('animationStateChanged', {
        animState: currentAnimState,
        direction: lastDirection,
        isMoving: velocity.x !== 0 || velocity.z !== 0
      });
    }
  }

  // Create medieval Japanese environment
  updateLoadingProgress(65, __("chatroom.loading.creating_3d"));
  createMedievalJapaneseEnvironment(scene);

  // Chatroom lighting setup optimized for 2D sprites
  updateLoadingProgress(75, __("chatroom.loading.setting_up_lighting"));
  const dirLight = new THREE.DirectionalLight(0xFFF8DC, 0.8); // Warm cornsilk
  dirLight.position.set(25, 50, 25);
  dirLight.castShadow = true;
  scene.add(dirLight);

  // Bright ambient light to ensure 2D sprites are well lit
  scene.add(new THREE.AmbientLight(0x606060, 0.6));
  
  // Central fountain area light
  const fountainLight = new THREE.PointLight(0xE6F3FF, 0.4, 30); // Cool blue-white
  fountainLight.position.set(0, 8, 0);
  scene.add(fountainLight);
  
  // Pavilion lights for gathering areas  
  const pavilionLightPositions = [
    { x: -25, z: -25 }, { x: 25, z: -25 },
    { x: -25, z: 25 }, { x: 25, z: 25 }
  ];
  
  pavilionLightPositions.forEach(pos => {
    const pavilionLight = new THREE.PointLight(0xFFE4B5, 0.4, 20);
    pavilionLight.position.set(pos.x, 9, pos.z);
    scene.add(pavilionLight);
  });

  camera.position.set(0, 10, 10);
  camera.lookAt(0, 0, 0);

  // Debug camera setup

  function createPlayer({ id, x, z, charType, direction, name: playerName, level, rankTitle, avatarUrl, expPoints }) {
    // Check if player already exists to prevent duplicates
    if (players[id]) {
      return;
    }
    
    const loader = new THREE.TextureLoader();
    const pd = {
      sprite: null,
      animTextures: {},
      animState: 'Idle',
      animFrame: 0,
      lastAnimTime: performance.now(),
      direction: direction || 1, // 1 = right, -1 = left
      x: x,
      z: z,
      name: playerName || __('chatroom.default_player_name'),
      level: level || 1,
      rankTitle: rankTitle || __('chatroom.default_rank_title'),
      avatarUrl: avatarUrl || '',
      expPoints: expPoints || 0,
      animLockState: null,
      animLockUntil: 0,
      // Add movement tracking for remote players
      _lastPos: { x: x, z: z },
      _lastMovementTime: 0,
      _movementVelocity: { x: 0, z: 0 },
      _animationStateTime: 0,
      _isMoving: false,
    };
    players[id] = pd;

    // Create chat bubble with simple styling
    const bubble = document.createElement('div');
    bubble.className =
    'chatBubble absolute left-1/2 -translate-x-1/2 ' +
    'px-3 py-2 rounded-lg shadow-lg bg-black/60 dark:bg-gray-800/70 ' +
    'text-white text-sm font-medium max-w-[160px] min-w-[50px] ' +
    'text-center pointer-events-none z-30';
    bubble.style.display = 'none';

    // Create player name label with rank badge and rank styling
    const nameLabel = document.createElement('div');
    let nameLabelClass = 'playerName absolute left-1/2 -translate-x-1/2 bottom-full mb-8 px-2 py-1 rounded text-white text-sm font-semibold pointer-events-auto z-40 cursor-pointer hover:bg-white/20 transition-colors duration-200';
    
    // Add special effects for high-rank users
    if (pd.level >= 15) {
      nameLabelClass += ' animate-pulse'; // Pulsing effect for very high rank users
    }
    
    nameLabel.className = nameLabelClass;
    
    // Create rank badge with color based on rank
    const rankColor = getRankColor(pd.level);
    let rankBadge = `<span class="inline-block px-1.5 py-0.5 rounded text-xs font-bold mr-1" style="background-color: ${rankColor}; color: white;">${pd.rankTitle}</span>`;
    
    // Add special crown for max rank users
    if (pd.level >= 20) {
      rankBadge = `👑 ${rankBadge}`;
    } else if (pd.level >= 15) {
      rankBadge = `⭐ ${rankBadge}`;
    }
    
    nameLabel.innerHTML = `${rankBadge}${pd.name}`;
    
    // Add special styling for VIP users
    if (pd.level >= 10) {
      nameLabel.style.textShadow = '0 0 10px rgba(255, 255, 255, 0.5)';
    }
    
    // Add rank title as tooltip
    if (pd.rankTitle) {
      nameLabel.title = `Click to view profile - ${pd.rankTitle} (${pd.expPoints} EXP)`;
    }
    
    // Add click event to show profile modal
    nameLabel.addEventListener('click', () => {
      if (window.showUserProfile) {
        window.showUserProfile(id);
      }
    });
    if (id !== socket.id) {
      overlay.appendChild(nameLabel);
    }

    overlay.appendChild(bubble);
    chatBubbles[id] = { bubble, nameLabel };

    // Function to create sprite when we have at least one texture
    function createSpriteIfNeeded() {
      if (pd.sprite) return; // Already created
      // Try to find any available texture to create the sprite
      const idleTextures = pd.animTextures['Idle'];
      if (idleTextures && idleTextures.length > 0) {
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ 
            map: idleTextures[0], 
            transparent: true,
            alphaTest: pd.alphaTest || 0.1
          })
        );
        const scale = pd.spriteScale || { x: 2, y: 2, z: 1 };
        sprite.scale.set(scale.x, scale.y, scale.z);
        sprite.position.set(x, pd.spriteHeight || 2, z);
        scene.add(sprite);
        pd.sprite = sprite;
      } else {
        for (const [state, textures] of Object.entries(pd.animTextures)) {
          if (textures && textures.length > 0) {
            const sprite = new THREE.Sprite(
              new THREE.SpriteMaterial({ 
                map: textures[0], 
                transparent: true,
                alphaTest: pd.alphaTest || 0.1
              })
            );
            const scale = pd.spriteScale || { x: 2, y: 2, z: 1 };
            sprite.scale.set(scale.x, scale.y, scale.z);
            sprite.position.set(x, pd.spriteHeight || 2, z);
            scene.add(sprite);
            pd.sprite = sprite;
            break;
          }
        }
      }
    }

    // Function to handle sheet animations
    function sliceSheet(state, info) {
      loader.load(
        `/chatroom/characters/${charType}/${info.file}`,
        (sheet) => {
          sheet.wrapS = sheet.wrapT = THREE.ClampToEdgeWrapping;
          sheet.magFilter = THREE.NearestFilter;
          sheet.minFilter = THREE.NearestFilter;
          sheet.format = THREE.RGBAFormat;
          
          const framesArr = [];
          const frameWidth = 1 / info.frames;
          const margin = 0.001; // Small margin to prevent bleeding
          
          for (let i = 0; i < info.frames; i++) {
            const tex = sheet.clone();
            tex.wrapS = THREE.ClampToEdgeWrapping;
            tex.wrapT = THREE.ClampToEdgeWrapping;
            
            // Add small margin to prevent texture bleeding
            const offsetX = (i * frameWidth) + margin;
            const repeatX = frameWidth - (margin * 2);
            
            tex.offset.set(offsetX, margin);
            tex.repeat.set(repeatX, 1 - (margin * 2));
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            tex.format = THREE.RGBAFormat;
            tex.needsUpdate = true;
            framesArr.push(tex);
          }
          pd.animTextures[state] = framesArr;
          createSpriteIfNeeded();
        },
        undefined,
        (error) => {
          // Error loading texture
        }
      );
    }

    // Load character configuration and animations
    loadCharacterConfig(charType).then(config => {
      const animStates = config.animations.states;
      
      // Store character configuration in player data
      pd.characterConfig = config;
      
      // Apply character-specific sprite settings
      if (config.display) {
        pd.spriteScale = config.display.scale || { x: 2, y: 2, z: 1 };
        pd.spriteHeight = config.display.spriteHeight || 2;
        pd.alphaTest = config.display.alphaTest || 0.1;
      }
      
      // Load all animations from character configuration
      for (const [state, info] of Object.entries(animStates)) {
        if (info.type === 'sheet') {
          sliceSheet(state, info);
        } else if (info.type === 'single') {
          loader.load(
            `/chatroom/characters/${charType}/${info.file}`,
            (tex) => {
              tex.magFilter = THREE.NearestFilter;
              tex.minFilter = THREE.NearestFilter;
              tex.format = THREE.RGBAFormat;
              tex.needsUpdate = true;
              pd.animTextures[state] = [tex];
              createSpriteIfNeeded();
            },
            undefined,
            (error) => {
              console.error(`Error loading texture ${info.file}:`, error);
            }
          );
        }
      }
    }).catch(error => {
      console.error(`Failed to load character config for ${charType}:`, error);
      // Use fallback loading (original system)
      const fallbackConfig = getFallbackCharacterConfig(charType);
      pd.characterConfig = fallbackConfig;
      for (const [state, info] of Object.entries(fallbackConfig.animations.states)) {
        if (info.type === 'sheet') {
          sliceSheet(state, info);
        }
      }
    });
  }

  function removePlayer(id) {
    const pd = players[id];
    if (pd && pd.sprite) {
      scene.remove(pd.sprite);
    }
    delete players[id];
    const chat = chatBubbles[id];
    if (chat) {
      if (chat.bubble) overlay.removeChild(chat.bubble);
      if (chat.nameLabel) overlay.removeChild(chat.nameLabel);
      delete chatBubbles[id];
    }
  }

  // Initialize socket connection with authentication (same pattern as default.js)
  updateLoadingProgress(85, __("chatroom.loading.connecting_to_server"));
  if (!window.user || !window.user.id || typeof io === 'undefined') {
    showErrorModal(__('chatroom.authentication_required'), __('chatroom.please_login_chatroom'));
    return;
  }
  
  // Get or generate session token (same as default.js)
  let sessionToken = sessionStorage.getItem('socket_token');
  if (!sessionToken) {
    sessionToken = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem('socket_token', sessionToken);
  }

  
  // Initialize socket with authentication
  socket = io({
    auth: {
      userId: window.user.id,
      token: sessionToken
    },
    transports: ['websocket', 'polling'],
    timeout: 5000
  });
  
  // Handle connection success
  socket.on('connect', () => {
    updateLoadingProgress(95, __("chatroom.loading.finalizing_setup"));
    
    // Use saved coordinates if available, otherwise spawn at center
    const spawnX = chatroomData?.lastX || 0;
    const spawnZ = chatroomData?.lastZ || 0;
    
    const userData = {
      name,
      charType,
      level: userProfile?.level || 1,
      rankTitle: userProfile?.rankTitle || __('chatroom.default_rank_title'),
      avatarUrl: userProfile?.avatarUrl || '',
      expPoints: userProfile?.expPoints || 0,
      x: spawnX,
      z: spawnZ
    };
    socket.emit('newUser', userData);
    updateConnectionStatus(true);
    
    // Load recent chat history
    loadChatHistory();
    
    // Complete loading and hide screen
    setTimeout(() => {
      updateLoadingProgress(100, __("chatroom.loading.welcome_to_world"));
      setTimeout(() => {
        hideLoadingScreen();
      }, 500);
    }, 300);
  });
  
  // Handle connection errors
  socket.on('connect_error', (error) => {
    const errorTitle = __('chatroom.connection_error');
    const errorMessage = __('chatroom.failed_connect_chatroom') + ': ' + error.message;
    showErrorModal(errorTitle, errorMessage);
    updateConnectionStatus(false);
  });
  
  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log('Disconnected from chatroom:', reason);
    updateConnectionStatus(false);
    
    // Show error modal instead of automatically reloading
    const disconnectTitle = __('chatroom.connection_lost');
    const disconnectMessage = __('chatroom.lost_connection_server') + ': ' + reason;
    showErrorModal(disconnectTitle, disconnectMessage);
  });
  
  // Handle being kicked from chatroom due to multiple connections
  socket.on('chatroom_kicked', (data) => {
    console.log('Kicked from chatroom:', data.message);
    
    // Stop the animation loop to prevent errors
    animationStopped = true;
    
    // Immediately disconnect and clean up the socket connection
    if (socket) {
      socket.removeAllListeners(); // Remove all event listeners
      socket.disconnect(true); // Force disconnect
      socket = null; // Clear the socket reference
    }
    
    // Update connection status
    updateConnectionStatus(false);
    
    // Show modal to user (indefinitely, no auto-reload)
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center';
    
    // Get translated strings first
    console.log('Available translations:', window.TRANSLATIONS);
    console.log('Checking chatroom translations:', window.TRANSLATIONS.chatroom);
    console.log('Looking for specific key:', window.TRANSLATIONS.chatroom?.multiple_connections_detected);
    console.log('Full chatroom object keys:', Object.keys(window.TRANSLATIONS.chatroom || {}));
    
    const titleText = __('chatroom.multiple_connections_detected');
    const messageText = __('chatroom.multiple_connections_message');
    const whatCanDoText = __('chatroom.what_you_can_do');
    const useOtherTabText = __('chatroom.use_other_chatroom_tab');
    const closeThisContinueText = __('chatroom.close_this_continue_other');
    const closeOtherRefreshText = __('chatroom.close_other_refresh_this');
    const closeTabText = __('chatroom.close_this_tab');
    const refreshReconnectText = __('chatroom.refresh_reconnect');
    
    console.log('Translated strings:', {
      titleText, messageText, whatCanDoText, useOtherTabText, 
      closeThisContinueText, closeOtherRefreshText, closeTabText, refreshReconnectText
    });
    
    modal.innerHTML = `
      <div class="bg-black/70 backdrop-blur-md absolute inset-0"></div>
      <div class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
        <div class="text-center mb-6">
          <div class="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
            </svg>
          </div>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">${titleText}</h3>
          <p class="text-gray-600 dark:text-gray-300">${messageText}</p>
        </div>
        
        <div class="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 mb-6">
          <div class="flex items-start space-x-3">
            <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div class="text-sm text-blue-800 dark:text-blue-200">
              <p class="font-medium mb-1">${whatCanDoText}</p>
              <ul class="list-disc list-inside space-y-1">
                <li>${useOtherTabText}</li>
                <li>${closeThisContinueText}</li>
                <li>${closeOtherRefreshText}</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div class="flex space-x-3">
          <button onclick="window.close()" class="flex-1 bg-gray-600 dark:bg-gray-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-700 dark:hover:bg-gray-600 transition">
            ${closeTabText}
          </button>
          <button onclick="window.location.reload()" class="flex-1 bg-purple-600 dark:bg-purple-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-700 dark:hover:bg-purple-600 transition">
            ${refreshReconnectText}
          </button>
        </div>
      </div>
    `;
    
    // Prevent body scroll and add modal
    document.body.style.overflow = 'hidden';
    document.body.appendChild(modal);
    
    // Prevent closing modal by clicking backdrop or escape key
    modal.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
    
    // Disable escape key and other shortcuts
    document.addEventListener('keydown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, true);
  });
  
  socket.on('currentPlayers', (serverPlayers) => {
    Object.values(serverPlayers).forEach(createPlayer);
    updateOnlineCount(Object.keys(serverPlayers).length);
    updatePlayersList();
  });
  socket.on('newPlayer', (playerData) => {
    createPlayer(playerData);
    updateOnlineCount(Object.keys(players).length + 1);
    updatePlayersList();
  });
  socket.on('playerMoved', ({ id, x, z, direction, animState }) => {
    const pd = players[id];
    if (pd) {
      const now = performance.now();
      
      // Calculate movement velocity for better animation detection
      const deltaTime = now - (pd._lastMovementTime || now);
      if (deltaTime > 0) {
        pd._movementVelocity.x = (x - pd.x) / deltaTime * 1000; // Convert to units per second
        pd._movementVelocity.z = (z - pd.z) / deltaTime * 1000;
      }
      
      // Update player data position immediately
      pd.x = x;
      pd.z = z;
      pd._lastMovementTime = now;
      
      if (typeof direction !== 'undefined') {
        pd.direction = direction;
      }
      
      // Store the animation state from the server
      if (animState) {
        pd._receivedAnimState = animState;
      }
      
      // Update sprite position if it exists
      if (pd.sprite) {
        pd.sprite.position.set(x, 2, z); // Keep Y at 2 for visibility
      }
      
      // Set movement flag - this will be handled in the animation loop
      pd._isMoving = true;
    }
  });
  socket.on('playerCharacterChanged', (playerData) => {
    const { id, charType, x, z, name, level, rankTitle, avatarUrl, expPoints, direction } = playerData;
    
    // Remove existing player
    removePlayer(id);
    
    // Create new player with updated character type
    createPlayer({
      id,
      x,
      z,
      charType,
      direction,
      name,
      level,
      rankTitle,
      avatarUrl,
      expPoints
    });
    
    // If this is the current player, update the global charType
    if (id === socket.id) {
      charType = playerData.charType;
    }
    
    updatePlayersList();
  });
  socket.on('playerDisconnected', (playerId) => {
    removePlayer(playerId);
    updateOnlineCount(Object.keys(players).length);
    updatePlayersList();
  });
  socket.on('chatMessage', ({ id, name, message }) => {
    const chat = chatBubbles[id];
    if (chat) {
      const { bubble } = chat;
      bubble.textContent = message;
      bubble.style.display = 'block';
      bubble.classList.add('chat-bubble');
      setTimeout(() => { 
        bubble.style.display = 'none'; 
        bubble.classList.remove('chat-bubble');
      }, 8000);
    }
    
    // Add to chat history - show "You:" for own messages
    const displayName = (id === socket.id) ? __('chatroom.you') : (name || __('chatroom.unknown_player'));
    const playerId = (id === socket.id) ? null : id; // Don't show rank badge for own messages
    addToChatHistory(displayName, message, playerId);
  });
  socket.on('playAnim', ({ id, animation, duration, direction }) => {
    const pd = players[id];
    if (pd) {
      console.log(`Playing animation ${animation} for player ${id} (duration: ${duration}ms)`);
      updateState(pd, animation, direction || pd.direction || 1);
      pd.animLockUntil = performance.now() + (duration || 600);
      pd.animLockState = animation;
    }
  });
  socket.on('animationStateChanged', ({ id, animState, direction, isMoving }) => {
    const pd = players[id];
    if (pd) {
      // Immediately update animation state without debouncing
      pd._receivedAnimState = animState;
      pd.direction = direction;
      pd._lastMovementTime = performance.now(); // Update movement time
      pd._isMoving = isMoving;
      
      // Apply animation immediately if not in special animation lock
      if (!pd.animLockState || performance.now() >= pd.animLockUntil) {
        if (isMoving) {
          updateState(pd, animState, direction);
        } else {
          updateState(pd, 'Idle', direction);
        }
      }
    }
  });


  window.addEventListener('keydown', (e) => {
    if (document.activeElement === chatInput) return;
    if (!socket || !socket.connected) return;
    
    const now = performance.now();
    function playSpecial(state, duration) {
      const localPd = players[socket.id];
      if (localPd) {
        console.log(`Sending animation ${state} to server (duration: ${duration}ms)`);
        updateState(localPd, state, lastDirection);
        animLockUntil = performance.now() + duration;
        animLockState = state;
        socket.emit('playAnim', { animation: state, duration, direction: lastDirection });
      }
    }
    
    switch (e.key.toLowerCase()) {
      case 'shift':
        isRunning = true;
        broadcastAnimationState(); // Immediately broadcast state change
        break;
      case 'arrowup':
      case 'w':
        velocity.z = -1;
        break;
      case 'arrowdown':
      case 's':
        velocity.z = 1;
        break;
      case 'arrowleft':
      case 'a':
        velocity.x = -1;
        lastDirection = -1; // Face left
        broadcastAnimationState(); // Immediately broadcast direction change
        break;
      case 'arrowright':
      case 'd':
        velocity.x = 1;
        lastDirection = 1; // Face right
        broadcastAnimationState(); // Immediately broadcast direction change
        break;
      case 'g':
        playSpecial('Attack_1', 600);
        // Award EXP for social interaction (with cooldown)
        const nowG = Date.now();
        if (nowG - lastInteractionTime > INTERACTION_EXP_COOLDOWN) {
          awardChatroomExp('social_interaction', 'attack_1');
          lastInteractionTime = nowG;
        }
        break;
      case 'h':
        playSpecial('Attack_2', 700);
        // Award EXP for social interaction (with cooldown)
        const nowH = Date.now();
        if (nowH - lastInteractionTime > INTERACTION_EXP_COOLDOWN) {
          awardChatroomExp('social_interaction', 'attack_2');
          lastInteractionTime = nowH;
        }
        break;
      case 'j':
        playSpecial('Attack_3', 600);
        // Award EXP for social interaction (with cooldown)
        const nowJ = Date.now();
        if (nowJ - lastInteractionTime > INTERACTION_EXP_COOLDOWN) {
          awardChatroomExp('social_interaction', 'attack_3');
          lastInteractionTime = nowJ;
        }
        break;
      case 'k':
        playSpecial('Shield', 500);
        // Award EXP for social interaction (with cooldown)
        const nowK = Date.now();
        if (nowK - lastInteractionTime > INTERACTION_EXP_COOLDOWN) {
          awardChatroomExp('social_interaction', 'shield');
          lastInteractionTime = nowK;
        }
        break;
      case ' ':
        e.preventDefault(); // Prevent default browser behavior
        playSpecial('Jump', 900);
        // Award EXP for social interaction (with cooldown)
        const nowSpace = Date.now();
        if (nowSpace - lastInteractionTime > INTERACTION_EXP_COOLDOWN) {
          awardChatroomExp('social_interaction', 'jump');
          lastInteractionTime = nowSpace;
        }
        break;
      case 't':
        // Teleport home when stuck
        if (socket && socket.connected) {
          socket.emit('teleportHome');
        }
        break;
    }
  });

  window.addEventListener('keyup', (e) => {
    switch (e.key.toLowerCase()) {
      case 'shift':
        isRunning = false;
        broadcastAnimationState(); // Immediately broadcast state change
        break;
      case 'arrowup':
      case 'w':
      case 'arrowdown':
      case 's':
        velocity.z = 0;
        broadcastAnimationState(); // Broadcast when stopping movement
        break;
      case 'arrowleft':
      case 'a':
      case 'arrowright':
      case 'd':
        velocity.x = 0;
        broadcastAnimationState(); // Broadcast when stopping movement
        break;
    }
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && chatInput.value.trim()) {
      if (socket && socket.connected) {
        const message = chatInput.value.trim();
        
        // Check for special commands
        if (message === '/home' || message === '/teleport' || message === '/stuck') {
          // Teleport player to safety
          socket.emit('teleportHome');
          chatInput.value = '';
          return;
        }
        
        socket.emit('chatMessage', message);
        chatInput.value = '';
        
        // Award EXP for chatroom message (with cooldown)
        const now = Date.now();
        if (now - lastMessageTime > MESSAGE_EXP_COOLDOWN) {
          awardChatroomExp('message');
          lastMessageTime = now;
        }
      }
    }
  });

  function updateState(pd, newState, direction = lastDirection) {
    if (!pd || !pd.sprite) return;
    
    // Determine the correct state based on direction
    let state = newState;
    if (direction === -1 && pd.animTextures[newState + '_Left']) {
      state = newState + '_Left';
    } else if (direction === 1 && pd.animTextures[newState]) {
      state = newState;
    } else if (pd.animTextures[newState]) {
      state = newState;
    } else if (pd.animTextures[newState + '_Left']) {
      state = newState + '_Left';
    }
    
    // Only change state if it's actually different and textures are available
    if (pd.animState !== state && pd.animTextures[state]) {
      // For debugging animation state changes
      if (Math.random() < 0.01) { // Log occasionally to avoid spam
        console.log(`Player animation change: ${pd.animState} -> ${state} (direction: ${direction})`);
      }
      
      pd.animState = state;
      pd.animFrame = 0;
      
      // For left sprites, start with the last frame (reverse order)
      let initialFrameIndex = 0;
      if (state.endsWith('_Left')) {
        initialFrameIndex = pd.animTextures[state].length - 1;
      }
      
      // Ensure the texture exists before applying it
      if (pd.animTextures[state][initialFrameIndex]) {
        pd.sprite.material.map = pd.animTextures[state][initialFrameIndex];
        pd.sprite.material.needsUpdate = true;
      }
      
      pd.lastAnimTime = performance.now();
      
      // Ensure consistent sprite scaling
      pd.sprite.scale.x = 2;
      pd.sprite.scale.y = 2;
      pd.sprite.scale.z = 1;
      
      // Update direction tracking
      pd.direction = direction;
      if (pd === players[socket?.id]) {
        lastAnimDirection = direction;
      }
    }
  }

  function animate() {
    if (animationStopped) {
      return; // Stop the animation loop
    }
    
    requestAnimationFrame(animate);
    const now = performance.now();
    const delta = (now - lastTime) / 1000;
    lastTime = now;

    const localPd = players[socket.id];
    if (localPd && localPd.sprite) {
      const s = localPd.sprite;
      if (now < animLockUntil && animLockState) {
        updateState(localPd, animLockState, lastDirection);
      } else {
        animLockState = null;
        if (velocity.x !== 0 || velocity.z !== 0) {
          // Use different speeds for walking vs running
          const currentSpeed = isRunning ? runSpeed : walkSpeed;
          let newX = s.position.x + velocity.x * currentSpeed * delta;
          let newZ = s.position.z + velocity.z * currentSpeed * delta;
          
          // Check collision before moving
          if (!checkCollision(newX, newZ)) {
            // Update sprite position only if no collision
            s.position.x = newX;
            s.position.z = newZ;
            localPd.x = newX;
            localPd.z = newZ;
            localPd.direction = lastDirection;
            if (socket && socket.connected) {
              const currentAnimState = isRunning ? 'Run' : 'Walk';
              socket.emit('move', { x: newX, z: newZ, direction: lastDirection, animState: currentAnimState });
              // Save coordinates to database periodically
              saveCoordinates(newX, newZ);
            }
          } else {
            // Try moving in individual axes if diagonal movement is blocked
            let canMoveX = !checkCollision(s.position.x + velocity.x * currentSpeed * delta, s.position.z);
            let canMoveZ = !checkCollision(s.position.x, s.position.z + velocity.z * currentSpeed * delta);
            
            if (canMoveX) {
              newX = s.position.x + velocity.x * currentSpeed * delta;
              newZ = s.position.z;
              s.position.x = newX;
              localPd.x = newX;
              localPd.direction = lastDirection;
              if (socket && socket.connected) {
                const currentAnimState = isRunning ? 'Run' : 'Walk';
              socket.emit('move', { x: newX, z: newZ, direction: lastDirection, animState: currentAnimState });
                // Save coordinates to database periodically
                saveCoordinates(newX, newZ);
              }
            } else if (canMoveZ) {
              newX = s.position.x;
              newZ = s.position.z + velocity.z * currentSpeed * delta;
              s.position.z = newZ;
              localPd.z = newZ;
              localPd.direction = lastDirection;
              if (socket && socket.connected) {
                const currentAnimState = isRunning ? 'Run' : 'Walk';
              socket.emit('move', { x: newX, z: newZ, direction: lastDirection, animState: currentAnimState });
                // Save coordinates to database periodically
                saveCoordinates(newX, newZ);
              }
            }
          }
          
          // Use Run animation if running mode is enabled, otherwise Walk
          const moveAnim = isRunning ? 'Run' : 'Walk';
          if (!animLockState) updateState(localPd, moveAnim, lastDirection);
        } else {
          if (!animLockState) updateState(localPd, 'Idle', lastDirection);
        }
      }
      camera.position.set(s.position.x, s.position.y + 2.5, s.position.z + 3);
      camera.lookAt(s.position);
    }

    // Handle animation lock for all players (including remote)
    Object.entries(players).forEach(([id, pd]) => {
      if (!pd.sprite) return;
      
      // For remote players, ensure sprite position matches player data
      if (id !== socket.id) {
        pd.sprite.position.x = pd.x;
        pd.sprite.position.z = pd.z;
        pd.sprite.position.y = 2; // Keep consistent Y position
        
        if (pd.animLockState && now < (pd.animLockUntil || 0)) {
          updateState(pd, pd.animLockState, pd.direction);
        } else {
          if (pd.animLockState) {
            pd.animLockState = null;
          }
          
          // Simplified animation system - trust received animation states immediately
          // No debouncing or complex movement detection for better responsiveness
          if (pd._isMoving && pd._receivedAnimState) {
            // Use the exact animation state received from the sender
            updateState(pd, pd._receivedAnimState, pd.direction);
          } else if (!pd._isMoving) {
            // Player stopped moving, use idle
            updateState(pd, 'Idle', pd.direction);
          }
        }
      }
      
      // Animate frames for all players
      const frames = pd.animTextures[pd.animState] || [];
      
      // Use character-specific frame rate or default to 80ms
      const frameRate = pd.characterConfig?.animations?.frameRate || 80;
      
      if (frames.length > 1 && now - pd.lastAnimTime > frameRate) {
        pd.animFrame = (pd.animFrame + 1) % frames.length;
        
        // For left sprites, play frames in reverse order
        let frameIndex = pd.animFrame;
        if (pd.animState && pd.animState.endsWith('_Left')) {
          frameIndex = frames.length - 1 - pd.animFrame;
        }
        
        // Ensure frame index is valid and texture exists
        if (frameIndex >= 0 && frameIndex < frames.length && frames[frameIndex]) {
          pd.sprite.material.map = frames[frameIndex];
          pd.sprite.material.needsUpdate = true;
        }
        pd.lastAnimTime = now;
      }
    });

    renderer.render(scene, camera);
    
    // Debug: log render info occasionally
    if (Math.random() < 0.001) {
      console.log('Rendering... Camera:', camera.position, 'Scene children:', scene.children.length);
    }

    // Update UI elements (name labels and chat bubbles) for ALL players
    Object.keys(players).forEach((id) => {
      const pd = players[id];
      const chat = chatBubbles[id];
      if (pd && pd.sprite && chat) {
        const { bubble, nameLabel } = chat;
        
        // Get the sprite's current world position
        const worldPos = pd.sprite.position.clone();
        worldPos.y += 1.2; // Offset above the sprite (closer to head)
        
        // Project to screen coordinates
        worldPos.project(camera);
        
        // Convert to screen pixel coordinates
        const x = (worldPos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-worldPos.y * 0.5 + 0.5) * window.innerHeight;
        
        // Check if the player is visible on screen
        const isVisible = worldPos.z < 1 && worldPos.x >= -1 && worldPos.x <= 1 && worldPos.y >= -1 && worldPos.y <= 1;
        
        if (isVisible) {
          // Always show name label above head
          if (id !== socket.id) {
            // other‐player name
            nameLabel.style.left      = x + 'px';
            nameLabel.style.top       = y + 'px';
            nameLabel.style.transform = 'translate(-50%, -100%)';
            nameLabel.style.display   = 'block';
          } else {
            // hide your own
            nameLabel.style.display = 'none';
          }        
          
          // Only show bubble if chatting
          if (bubble.style.display === 'block') {
            bubble.style.left = x + 'px';
            bubble.style.top = (y - 8) + 'px'; // Offset above name label (closer)
            bubble.style.transform = 'translate(-50%, -100%)';
          }
        } else {
          // Hide UI elements when player is off-screen
          nameLabel.style.display = 'none';
          if (bubble.style.display === 'block') {
            bubble.style.display = 'none';
          }
        }
      }
    });
  }
  
  // Simple UI utility functions
  function updateConnectionStatus(connected) {
    console.log('Connection status:', connected ? 'Connected' : 'Disconnected');
  }
  
  function updateOnlineCount(count) {
    console.log('Online players:', count);
    const onlineCountElement = document.getElementById('onlineCount');
    if (onlineCountElement) {
      onlineCountElement.textContent = count;
    }
    updatePlayersList();
  }
  
  function updatePlayersList() {
    const playersListElement = document.getElementById('playersList');
    if (!playersListElement) return;
    
    // Get all players and sort by rank (highest first)
    const playerEntries = Object.entries(players).sort(([, a], [, b]) => b.level - a.level);
    
    playersListElement.innerHTML = playerEntries.map(([id, player]) => {
      const levelColor = getRankColor(player.level);
      let playerIcon = '';
      
      if (player.level >= 20) {
        playerIcon = '👑';
      } else if (player.level >= 15) {
        playerIcon = '⭐';
      } else if (player.level >= 10) {
        playerIcon = '💎';
      }
      
      return `
        <div class="flex items-center justify-between py-1 px-2 rounded hover:bg-white/10 cursor-pointer" onclick="showUserProfile('${id}')">
          <div class="flex items-center space-x-1">
            ${playerIcon ? `<span>${playerIcon}</span>` : ''}
            <span class="font-medium">${escapeHtml(player.name)}</span>
          </div>
          <span class="px-1 py-0.5 rounded text-xs font-bold" style="background-color: ${levelColor}; color: white;">
            ${player.level}
          </span>
        </div>
      `;
    }).join('');
  }
  
  function addToChatHistory(name, message, playerId = null) {
    const chatHistory = document.getElementById('chatHistory');
    const chatContainer = document.getElementById('chatContainer');
    if (!chatHistory) return;
    
    // Show chat container when first message arrives
    if (chatContainer && chatContainer.style.display === 'none') {
      chatContainer.style.display = 'block';
    }
    
    // Get player data for styling
    let levelBadge = '';
    let nameClass = 'font-medium text-white';
    let messageClass = 'text-white/80 flex-1';
    
    if (playerId && players[playerId]) {
      const player = players[playerId];
      const levelColor = getRankColor(player.level);
      
      // Create rank badge with special icons
      let badgeContent = `R${player.level}`;
      if (player.level >= 20) {
        badgeContent = `👑 ${badgeContent}`;
      } else if (player.level >= 15) {
        badgeContent = `⭐ ${badgeContent}`;
      }
      
      levelBadge = `<span class="inline-block px-1 py-0.5 rounded text-xs font-bold mr-1" style="background-color: ${levelColor}; color: white;">${badgeContent}</span>`;
      
      // Adjust name and message styling based on level
      if (player.level >= 20) {
        nameClass = 'font-bold text-yellow-300 drop-shadow-lg'; // Max rank users get golden glow
        messageClass = 'text-yellow-100 flex-1 font-medium'; // Special message styling
      } else if (player.level >= 15) {
        nameClass = 'font-bold text-purple-300'; // Very high rank users get purple
        messageClass = 'text-purple-100 flex-1';
      } else if (player.level >= 10) {
        nameClass = 'font-semibold text-blue-300'; // High rank users get blue
        messageClass = 'text-blue-100 flex-1';
      } else if (player.level >= 5) {
        nameClass = 'font-medium text-green-300'; // Medium rank users get green
      }
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = 'text-sm';
    messageElement.innerHTML = `
      <div class="flex items-start space-x-2">
        <span class="${nameClass}">${levelBadge}${escapeHtml(name)}:</span>
        <span class="${messageClass}">${escapeHtml(message)}</span>
      </div>
    `;
    
    chatHistory.appendChild(messageElement);
    
    // Remove old messages (keep last 15)
    const messages = chatHistory.children;
    if (messages.length > 15) {
      messages[0].remove();
    }
    
    // Scroll to bottom
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Load chat history from cache
  function loadChatHistory() {
    $.ajax({
      url: '/chatroom/history',
      method: 'GET',
      dataType: 'json'
    })
    .done(function(data) {
      if (data.status === 200 && data.data.messages) {
        console.log('Loading chat history:', data.data.messages.length + ' messages');
        
        // Clear existing chat history
        const chatHistory = document.getElementById('chatHistory');
        if (chatHistory) {
          chatHistory.innerHTML = '';
        }
        
        // Add each message to chat history
        data.data.messages.forEach(message => {
          // Find the player ID if this message is from a current player
          let playerId = null;
          Object.entries(players).forEach(([id, player]) => {
            if (player.name === message.name) {
              playerId = id;
            }
          });
          
          // Display cached message
          addToChatHistory(message.name, message.message, playerId);
        });
        
        console.log('Chat history loaded successfully');
      }
    })
    .fail(function(xhr, status, error) {
      console.error('Failed to load chat history:', error);
    });
  }
  
  // EXP notification functions
  async function awardChatroomExp(action, interaction = null) {
    if (!window.user || !window.user.id) return;
    
    try {
      const data = await $.post('/chatroom/award-exp', {
        action: action,
        interaction: interaction
      });
      
      if (data.status === 200 && data.data.expGained > 0) {
        showExpNotification(data.data);
        
        // Update user profile with new values
        if (userProfile) {
          userProfile.expPoints = data.data.totalExp;
          userProfile.level = data.data.newLevel;
          
          if (data.data.leveledUp) {
            showLevelUpNotification(data.data);
          }
        }
      }
    } catch (error) {
      console.error('Error awarding chatroom EXP:', error);
    }
  }
  
  function showExpNotification(expData) {
    const notification = document.createElement('div');
    notification.className = 'fixed top-20 right-4 bg-green-500 dark:bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 transform translate-x-full transition-transform duration-300';
    notification.innerHTML = `
      <div class="flex items-center space-x-2">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
        </svg>
        <span>+${expData.expGained} EXP</span>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.classList.remove('translate-x-full');
    }, 100);
    
    // Animate out and remove
    setTimeout(() => {
      notification.classList.add('translate-x-full');
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }
  
  function showLevelUpNotification(expData) {
    const notification = document.createElement('div');
    notification.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-yellow-400 to-orange-500 dark:from-yellow-500 dark:to-orange-600 text-white px-8 py-6 rounded-xl shadow-2xl z-50 opacity-0 scale-75 transition-all duration-500';
    notification.innerHTML = `
      <div class="text-center">
        <div class="text-3xl font-bold mb-2">🎉 RANK UP! 🎉</div>
        <div class="text-xl font-semibold">Rank ${expData.newLevel}</div>
        <div class="text-sm opacity-90">+${expData.expGained} EXP gained</div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.classList.remove('opacity-0', 'scale-75');
      notification.classList.add('opacity-100', 'scale-100');
    }, 100);
    
    // Animate out and remove
    setTimeout(() => {
      notification.classList.add('opacity-0', 'scale-75');
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 500);
    }, 4000);
  }
  
  // Track messages for EXP (limit to prevent spam)
  let lastMessageTime = 0;
  const MESSAGE_EXP_COOLDOWN = 30000; // 30 seconds between message EXP
  
  // Track social interactions for EXP
  let lastInteractionTime = 0;
  const INTERACTION_EXP_COOLDOWN = 10000; // 10 seconds between interaction EXP
  
  // Save coordinates when leaving the page
  window.addEventListener('beforeunload', () => {
    const localPd = players[socket?.id];
    if (localPd && socket && socket.connected) {
      // Force save coordinates before leaving
      saveCoordinates(localPd.x, localPd.z);
    }
  });
  
  // Error modal function
  function showErrorModal(title, message) {
    // Remove any existing error modals first
    const existingModals = document.querySelectorAll('[data-error-modal]:not(#errorModalTemplate)');
    existingModals.forEach(modal => modal.remove());
    
    // Clone the template
    const template = document.getElementById('errorModalTemplate');
    if (!template) {
      console.error('Error modal template not found');
      return;
    }
    
    const modal = template.cloneNode(true);
    modal.id = 'errorModal'; // Give it a unique ID
    modal.classList.remove('hidden');
    
    // Update the content
    modal.querySelector('#errorModalTitle').textContent = title;
    modal.querySelector('#errorModalMessage').textContent = message;
    
    // Add event listeners
    modal.querySelector('#errorModalHomeBtn').onclick = () => {
      modal.remove();
      document.body.style.overflow = '';
      window.location.href = '/';
    };
    
    modal.querySelector('#errorModalRetryBtn').onclick = () => {
      window.location.reload();
    };
    
    // Prevent body scroll and add modal
    document.body.style.overflow = 'hidden';
    document.body.appendChild(modal);
    
    // Prevent closing modal by clicking backdrop or escape key
    modal.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
  }
  
  animate();
})();

// Controls widget toggle functionality
function toggleControls() {
  const content = document.getElementById('controlsContent');
  const toggle = document.getElementById('controlsToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.style.transform = 'rotate(0deg)';
  } else {
    content.style.display = 'none';
    toggle.style.transform = 'rotate(-90deg)';
  }
}


// Initialize controls state
document.addEventListener('DOMContentLoaded', function() {
  
  // Populate character selection dropdown when available
  const populateCharacterSelect = async () => {
    const charTypeSelect = document.getElementById('charType');
    if (charTypeSelect) {
      // Load character types if not already loaded
      if (types.length === 0) {
        await loadAvailableCharacterTypes();
      }
      
      if (types.length > 0) {
        charTypeSelect.innerHTML = '';
        types.forEach(characterType => {
          const option = document.createElement('option');
          option.value = characterType;
          option.textContent = characterType;
          charTypeSelect.appendChild(option);
        });
        charTypeSelect.value = charType || types[0];
        console.log('Character dropdown populated with:', types);
      } else {
        console.warn('No character types available, using fallback');
        charTypeSelect.innerHTML = '<option value="Fighter">Fighter</option>';
        charTypeSelect.value = 'Fighter';
      }
    }
  };
  
  // Populate character select
  populateCharacterSelect();
});