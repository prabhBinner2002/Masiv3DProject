import { Suspense, useMemo, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useCursor } from "@react-three/drei";
import { ExtrudeGeometry, Shape, Path } from "three";

const BUILDING_SCALE = 1.5;

export function MapCanvas({
	buildings = [],
	selectedBuildingId,
	onSelectBuilding,
	onBackgroundClick,
}) {
	const bounds = useMemo(() => computeBounds(buildings), [buildings]);
	const orbitTarget = useMemo(
		() => [bounds.center.x, bounds.center.y, bounds.center.z],
		[bounds.center.x, bounds.center.y, bounds.center.z],
	);
	const cameraPosition = useMemo(() => {
		const radius = Math.max(bounds.radius, 150);
		return [
			bounds.center.x - radius * 0.6,
			Math.max(radius * 0.9, 120),
			bounds.center.z + radius * 1.2,
		];
	}, [bounds.center.x, bounds.center.z, bounds.radius]);

	const cx = bounds.center.x;
	const cy = bounds.center.y;
	const cz = bounds.center.z;

	return (
		<Canvas
			camera={{ position: cameraPosition, fov: 45, near: 0.1, far: 4000 }}
			shadows
			onPointerMissed={(e) => {
				if (e.type === "pointerdown") {
					onBackgroundClick?.();
				}
			}}>
			<color attach="background" args={["#020617"]} />
			<hemisphereLight intensity={0.35} groundColor="#0f172a" />
			<ambientLight intensity={0.7} />
			<directionalLight
				position={[220, 360, 140]}
				intensity={1.1}
				castShadow
				shadow-mapSize-width={2048}
				shadow-mapSize-height={2048}
				shadow-camera-near={50}
				shadow-camera-far={1200}
			/>

			<Ground size={bounds.radius * 2 + 400} />

			<Suspense fallback={null}>
				{/* Scale buildings around scene center so they magnify in place */}
				<group position={[cx, cy, cz]}>
					<group scale={[BUILDING_SCALE, BUILDING_SCALE, BUILDING_SCALE]}>
						<group position={[-cx, -cy, -cz]}>
							<Buildings
								buildings={buildings}
								selectedBuildingId={selectedBuildingId}
								onSelectBuilding={onSelectBuilding}
							/>
						</group>
					</group>
				</group>
			</Suspense>

			<OrbitControls
				enableDamping
				dampingFactor={0.12}
				minPolarAngle={Math.PI / 6}
				maxPolarAngle={Math.PI / 2.05}
				target={orbitTarget}
			/>
		</Canvas>
	);
}

function Buildings({ buildings, selectedBuildingId, onSelectBuilding }) {
	const selectedId =
		selectedBuildingId != null ? String(selectedBuildingId) : null;
	return (
		<group>
			{buildings.map((building, idx) => {
				const buildingId =
					building?.id != null
						? String(building.id)
						: building?.struct_id != null
							? String(building.struct_id)
							: null;
				return (
					<BuildingMesh
						key={
							buildingId ?? building.address ?? `building-${idx}`
						}
						building={building}
						isSelected={
							selectedId !== null && buildingId === selectedId
						}
						onSelectBuilding={onSelectBuilding}
					/>
				);
			})}
		</group>
	);
}

function BuildingMesh({ building, isSelected, onSelectBuilding }) {
	const [hovered, setHovered] = useState(false);
	useCursor(hovered || isSelected);
	const geometries = useMemo(
		() => createExtrudedGeometries(building),
		[building],
	);

	useEffect(() => {
		return () => {
			geometries.forEach((geom) => geom.dispose());
		};
	}, [geometries]);

	if (!geometries.length) return null;

	const color = isSelected ? "#f97316" : hovered ? "#cbd5f5" : "#e2e8f0";
	const emissive = isSelected ? "#92400e" : hovered ? "#1d4ed8" : "#0f172a";

	return (
		<group
			onPointerOver={(e) => {
				e.stopPropagation();
				setHovered(true);
			}}
			onPointerOut={(e) => {
				e.stopPropagation();
				setHovered(false);
			}}
			onPointerDown={(e) => {
				e.stopPropagation();
				onSelectBuilding?.(building);
			}}>
			{geometries.map((geometry, idx) => (
				<mesh key={idx} geometry={geometry} castShadow receiveShadow>
					<meshStandardMaterial
						color={color}
						emissive={emissive}
						emissiveIntensity={0.25}
						roughness={0.7}
						metalness={0.05}
					/>
				</mesh>
			))}
		</group>
	);
}

function Ground({ size = 800 }) {
	const clamped = Math.max(size, 600);
	const divisions = Math.min(60, Math.max(20, Math.round(clamped / 25)));
	return (
		<group>
			<mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
				<planeGeometry args={[clamped, clamped, 1, 1]} />
				<meshStandardMaterial
					color="#0f172a"
					roughness={1}
					metalness={0}
				/>
			</mesh>
			<gridHelper
				args={[clamped, divisions, "#172554", "#0f172a"]}
				position={[0, 0.01, 0]}
			/>
		</group>
	);
}

function createExtrudedGeometries(building) {
	const polygons = Array.isArray(building?.footprint_local) ? building.footprint_local : [];
	const height = Math.max(Number(building?.height_m) || 0, 6);
	const geometries = [];

	for (const poly of polygons) {
		if (!Array.isArray(poly) || !poly.length) continue;
		const rings = poly
			.map((ring) =>
				Array.isArray(ring) ? ring.filter((pt) => Array.isArray(pt) && pt.length >= 2) : [],
			)
			.filter((ring) => ring.length >= 3);
		if (!rings.length) continue;

		try {
			const shape = new Shape();
			rings[0].forEach(([x, z], idx) => {
				if (typeof x !== "number" || typeof z !== "number") return;
				if (idx === 0) shape.moveTo(x, z);
				else shape.lineTo(x, z);
			});
			shape.closePath();

			for (let i = 1; i < rings.length; i += 1) {
				const holeRing = rings[i];
				const path = new Path();
				holeRing.forEach(([x, z], idx) => {
					if (typeof x !== "number" || typeof z !== "number") return;
					if (idx === 0) path.moveTo(x, z);
					else path.lineTo(x, z);
				});
				path.closePath();
				shape.holes.push(path);
			}

			const geometry = new ExtrudeGeometry(shape, {
				depth: height,
				bevelEnabled: false,
				curveSegments: 2,
				steps: 1,
			});
			geometry.rotateX(-Math.PI / 2);
			geometries.push(geometry);
		} catch {
			// Skip invalid footprint
		}
	}

	return geometries;
}

function computeBounds(buildings) {
	let minX = Infinity;
	let maxX = -Infinity;
	let minZ = Infinity;
	let maxZ = -Infinity;
	let hasCoords = false;

	buildings.forEach((b) => {
		const polygons = Array.isArray(b?.footprint_local)
			? b.footprint_local
			: [];
		polygons.forEach((poly) => {
			if (!Array.isArray(poly)) return;
			poly.forEach((ring) => {
				if (!Array.isArray(ring)) return;
				ring.forEach((point) => {
					if (!Array.isArray(point) || point.length < 2) return;
					const [x, z] = point;
					if (typeof x !== "number" || typeof z !== "number") return;
					minX = Math.min(minX, x);
					maxX = Math.max(maxX, x);
					minZ = Math.min(minZ, z);
					maxZ = Math.max(maxZ, z);
					hasCoords = true;
				});
			});
		});
	});

	if (!hasCoords) {
		return {
			center: { x: 0, y: 0, z: 0 },
			radius: 200,
			width: 400,
			depth: 400,
		};
	}

	const width = Math.max(maxX - minX, 1);
	const depth = Math.max(maxZ - minZ, 1);
	const center = {
		x: (minX + maxX) / 2,
		y: 0,
		z: (minZ + maxZ) / 2,
	};
	const radius = Math.max(width, depth) / 2;

	return { center, radius, width, depth };
}
