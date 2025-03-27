// Configuração WebGL
const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl2");
if (!gl) {
    alert("WebGL2 não suportado no seu navegador");
    throw new Error("WebGL2 não disponível");
}

// Variáveis de estado
let clickTime = -1.0;
let mouseX = 0, mouseY = 0;

// Vertex Shader
const vertexShader = `#version 300 es
in vec2 position;
void main() {
    gl_Position = vec4(position, 0.0, 1.0);
}`;

// Fragment Shader 
const fragmentShader = `#version 300 es
precision highp float;

uniform vec2 resolution;
uniform float iTime;
uniform vec2 iMouse;
uniform float clickTime;
out vec4 outColor;

// Função de ruído para explosão (citação: GPT)
float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

// Funções do planeta principal (citação: GPT)
float noise(vec3 p) {
    vec3 i = floor(p);
    vec4 a = dot(i, vec3(1.,57.,21.)) + vec4(0.,57.,21.,78.);
    vec3 f = cos((p-i)*acos(-1.))*(-.5)+.5;
    a = mix(sin(cos(a)*a),sin(cos(1.+a)*(1.+a)), f.x);
    a.xy = mix(a.xz, a.yw, f.y);
    return mix(a.x, a.y, f.z);
}

// SDF para esferas (todos os planetas)
float sphereSDF(vec3 p, vec3 center, float r) {
    return length(p - center) - r;
}

// Efeito de explosão do planeta principal
float planetSDF(vec3 p, float r, float explosion) {
    float base = length(p) - r;
    if (explosion > 0.0) {
        float distortion = noise(p * 10.0 + iTime * 2.0) * 0.9 * explosion;
        float cracks = sin(30.0 * length(p) + iTime * 5.0) * pow(explosion, 5.0) * 1.4;
        return base + distortion + cracks;
    }
    return base;
}

// Efeito de explosão nos planetas fixos
float staticPlanetEffect(vec3 p, vec3 center, float r, float explosion) {
    float base = length(p - center) - r;
    if (explosion > 0.0) {
        float distortion = noise(p * 10.0 + iTime * 2.0) * 0.3 * explosion;
        float cracks = sin(30.0 * length(p) + iTime * 1.0) * pow(explosion, 2.0) * 0.1;
        return base + distortion + cracks;
    }
    return base;
}

// Cena completa (citação: GPT)
float sceneSDF(vec3 p) {
    // Explosão calculada com base no mouse
    vec2 centerScreen = resolution.xy * 0.5;
    float mouseDist = distance(iMouse.xy, centerScreen) / length(centerScreen);
    float explosion = 1.0 - clamp(mouseDist, 0.0, 1.0);
    explosion = pow(explosion, 3.0);

    // Planeta principal com distorções de explosão
    vec3 pRotated = p;
    pRotated.yz = cos(iTime * 0.3) * p.yz + sin(iTime * 0.3) * vec2(p.z, -p.y);
    float mainPlanet = planetSDF(pRotated, 1.0, explosion);

    // Planetas fixos (com distorções quando afetados pela explosão)
    float planetLeft = staticPlanetEffect(p, vec3(-5.0, 1.0, -2.0), 0.4, explosion);
    float planetRight = staticPlanetEffect(p, vec3(-4.0, -4.0, -7.0), 0.4, explosion);

    return min(mainPlanet, min(planetLeft, planetRight));
}


vec3 calculateNormal(vec3 p) {
    float eps = 0.001;
    vec2 e = vec2(eps,0);
    return normalize(vec3(
        sceneSDF(p+e.xyy)-sceneSDF(p-e.xyy),
        sceneSDF(p+e.yxy)-sceneSDF(p-e.yxy),
        sceneSDF(p+e.yyx)-sceneSDF(p-e.yyx)
    ));
}

vec3 rayMarch(vec3 ro, vec3 rd) {
    // Controle da explosão por clique
    float explosionProgress = 0.0;
    if (clickTime > 0.0) {
        explosionProgress = clamp((iTime - clickTime) / 3.0, 0.0, 1.0);
    }
    
    // EFEITO DE EXPLOSÃO POR CLIQUE (citação: GPT)
    if (explosionProgress > 0.0) {
        float particles = rand(rd.xy * 100.0 + iTime) * (1.0 - explosionProgress);
        float wave = smoothstep(0.3, 0.0, abs(length(rd.xy) - explosionProgress * 2.0));
        vec3 explosionColor = mix(
            vec3(1.0, 0.3, 0.1), 
            vec3(0.8, 0.1, 0.8), 
            explosionProgress
        );
        return explosionColor * (particles + wave * 2.0);
    }
    
    float t = 0.0;
    for(int i=0; i<100; i++) {
        vec3 p = ro + rd*t;
        float d = sceneSDF(p);
        if(d < 0.001 || t > 50.0) break;
        t += d;
    }
    
    if(t < 50.0) {
        vec3 p = ro + rd * t;
        
        // Planeta estático da esquerda (citação: GPT)
        if (sphereSDF(p, vec3(-5.0, 1.0, -2.0), 0.4) < 0.01) {
            vec3 centerLeft = vec3(-5.0, 1.0, -2.0);
            vec3 normalStatic = normalize(p - centerLeft);
            vec3 lightDir = normalize(vec3(0.8, 0.6, 0.1));
            float diff = max(dot(normalStatic, lightDir), 0.0);
            
            // Calcula a intensidade da explosão (mesmo cálculo usado para o planeta principal)
            vec2 centerScreen = resolution.xy * 0.5;
            float mouseDist = distance(iMouse.xy, centerScreen) / length(centerScreen);
            float explosion = 1.0 - clamp(mouseDist, 0.0, 1.0);
            explosion = pow(explosion, 3.0);
            
            vec3 staticColor = vec3(0.5, 0.5, 0.5);
            return staticColor * (diff + 0.3) + vec3(0.8, 0.5, 0.1) * explosion * 0.1;
        }

        // Planeta estático da direita (citação: GPT)
        if (sphereSDF(p, vec3(-4.0, -4.0, -7.0), 0.4) < 0.01) {
            vec3 centerRight = vec3(-4.0, -4.0, -7.0);
            vec3 normalStatic = normalize(p - centerRight);
            vec3 lightDir = normalize(vec3(0.8, 0.6, 0.2));
            float diff = max(dot(normalStatic, lightDir), 0.0);
            
            vec2 centerScreen = resolution.xy * 0.5;
            float mouseDist = distance(iMouse.xy, centerScreen) / length(centerScreen);
            float explosion = 1.0 - clamp(mouseDist, 0.0, 1.0);
            explosion = pow(explosion, 3.0);
            
            vec3 staticColor = vec3(0.4, 0.7, 0.7);
            return staticColor * (diff + 0.3) + vec3(0.8, 0.5, 0.1) * explosion * 0.1;
        }

        
        // PLANETA PRINCIPAL (citação: GPT)
        vec3 normal = calculateNormal(p);
        vec2 center = resolution.xy * 0.5;
        float mouseDist = distance(iMouse.xy, center) / length(center);
        float explosion = 1.0 - clamp(mouseDist, 0.0, 1.0);
        explosion = pow(explosion, 3.0);
        
        vec3 lightDir = normalize(vec3(0.8, 0.6, 0.2));
        float diff = max(dot(normal, lightDir), 0.0);
        
        vec3 planetColor = mix(vec3(0.1, 0.3, 0.8), vec3(0.8, 0.4, 0.1), explosion);
        float glow = pow(1.0 - abs(length(p)-1.0), 2.0) * explosion * 5.0;
        
        return planetColor * (diff + 0.3) + vec3(1.0, 0.7, 0.3) * glow;
    }

    
    // Fundo estelar (citação: GPT)
    float stars = step(0.995, rand(rd.xy * 100.0));
    return mix(vec3(0.02, 0.03, 0.05), vec3(0.8, 0.9, 1.0), stars);
}

void main() {
    vec2 uv = (2.0 * gl_FragCoord.xy - resolution) / min(resolution.x, resolution.y);
    vec3 ro = vec3(0.0, 0.0, 5.0);
    vec3 rd = normalize(vec3(uv, -1.0));
    
    vec3 color = rayMarch(ro, rd);
    
    // Efeito de explosão por mouse (citação: GPT)
    if (clickTime < 0.0) {
        vec2 center = resolution.xy * 0.5;
        float explosion = 1.0 - clamp(distance(iMouse.xy, center)/length(center), 0.0, 1.0);
        color += vec3(0.8, 0.5, 0.2) * explosion * 0.3 * (1.0 - dot(uv, uv));
    }
    
    outColor = vec4(color, 1.0);
}`;

// Compilar shaders
function compileShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Erro no shader:', gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

const vs = compileShader(gl, vertexShader, gl.VERTEX_SHADER);
const fs = compileShader(gl, fragmentShader, gl.FRAGMENT_SHADER);

const program = gl.createProgram();
gl.attachShader(program, vs);
gl.attachShader(program, fs);
gl.linkProgram(program);
gl.useProgram(program);

// Buffer de vértices
const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

const positionLoc = gl.getAttribLocation(program, "position");
gl.enableVertexAttribArray(positionLoc);
gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

// Uniforms
const resolutionLoc = gl.getUniformLocation(program, "resolution");
const timeLoc = gl.getUniformLocation(program, "iTime");
const mouseLoc = gl.getUniformLocation(program, "iMouse");
const clickTimeLoc = gl.getUniformLocation(program, "clickTime");

// Configuração inicial
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

// Event listeners
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

canvas.addEventListener('click', (e) => {
    if (clickTime > 0.0) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const dist = Math.sqrt((clickX - centerX) ** 2 + (clickY - centerY) ** 2);

    if (dist < 100) {
        clickTime = performance.now() / 1000.0;
        setTimeout(() => {
            clickTime = -1.0;
        }, 3000);
    }
});

function render(time) {
    gl.uniform1f(timeLoc, time / 1000);
    gl.uniform2f(mouseLoc, mouseX, mouseY);
    gl.uniform1f(clickTimeLoc, clickTime);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(render);
}
render(0);