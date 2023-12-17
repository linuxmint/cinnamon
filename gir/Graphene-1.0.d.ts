/** Generated with https://github.com/Gr3q/GIR2TS - If possible do not modify. */
declare namespace imports.gi.Graphene {
	export interface BoxInitOptions {}
	/**
	 * A 3D box, described as the volume between a minimum and
	 * a maximum vertices.
	 */
	interface Box {}
	class Box {
		public constructor(options?: Partial<BoxInitOptions>);
		/**
		 * Allocates a new #graphene_box_t.
		 * 
		 * The contents of the returned structure are undefined.
		 * @returns the newly allocated #graphene_box_t structure.
		 *   Use {@link Graphene.Box.free} to free the resources allocated by this function
		 */
		public static alloc(): Box;
		/**
		 * A degenerate #graphene_box_t that can only be expanded.
		 * 
		 * The returned value is owned by Graphene and should not be modified or freed.
		 * @returns a #graphene_box_t
		 */
		public static empty(): Box;
		/**
		 * A degenerate #graphene_box_t that cannot be expanded.
		 * 
		 * The returned value is owned by Graphene and should not be modified or freed.
		 * @returns a #graphene_box_t
		 */
		public static infinite(): Box;
		/**
		 * A #graphene_box_t with the minimum vertex set at (-1, -1, -1) and the
		 * maximum vertex set at (0, 0, 0).
		 * 
		 * The returned value is owned by Graphene and should not be modified or freed.
		 * @returns a #graphene_box_t
		 */
		public static minus_one(): Box;
		/**
		 * A #graphene_box_t with the minimum vertex set at (0, 0, 0) and the
		 * maximum vertex set at (1, 1, 1).
		 * 
		 * The returned value is owned by Graphene and should not be modified or freed.
		 * @returns a #graphene_box_t
		 */
		public static one(): Box;
		/**
		 * A #graphene_box_t with the minimum vertex set at (-1, -1, -1) and the
		 * maximum vertex set at (1, 1, 1).
		 * 
		 * The returned value is owned by Graphene and should not be modified or freed.
		 * @returns a #graphene_box_t
		 */
		public static one_minus_one(): Box;
		/**
		 * A #graphene_box_t with both the minimum and maximum vertices set at (0, 0, 0).
		 * 
		 * The returned value is owned by Graphene and should not be modified or freed.
		 * @returns a #graphene_box_t
		 */
		public static zero(): Box;
		public readonly min: Vec3;
		public readonly max: Vec3;
		/**
		 * Checks whether the #graphene_box_t #a contains the given
		 * #graphene_box_t #b.
		 * @param b a #graphene_box_t
		 * @returns `true` if the box is contained in the given box
		 */
		public contains_box(b: Box): boolean;
		/**
		 * Checks whether #box contains the given #point.
		 * @param point the coordinates to check
		 * @returns `true` if the point is contained in the given box
		 */
		public contains_point(point: Point3D): boolean;
		/**
		 * Checks whether the two given boxes are equal.
		 * @param b a #graphene_box_t
		 * @returns `true` if the boxes are equal
		 */
		public equal(b: Box): boolean;
		/**
		 * Expands the dimensions of #box to include the coordinates at #point.
		 * @param point the coordinates of the point to include
		 * @returns return location for the expanded box
		 */
		public expand(point: Point3D): Box;
		/**
		 * Expands the dimensions of #box by the given #scalar value.
		 * 
		 * If #scalar is positive, the #graphene_box_t will grow; if #scalar is
		 * negative, the #graphene_box_t will shrink.
		 * @param scalar a scalar value
		 * @returns return location for the expanded box
		 */
		public expand_scalar(scalar: number): Box;
		/**
		 * Expands the dimensions of #box to include the coordinates of the
		 * given vector.
		 * @param vec the coordinates of the point to include, as a #graphene_vec3_t
		 * @returns return location for the expanded box
		 */
		public expand_vec3(vec: Vec3): Box;
		/**
		 * Frees the resources allocated by {@link Graphene.Box.alloc}.
		 */
		public free(): void;
		/**
		 * Computes the bounding #graphene_sphere_t capable of containing the given
		 * #graphene_box_t.
		 * @returns return location for the bounding sphere
		 */
		public get_bounding_sphere(): Sphere;
		/**
		 * Retrieves the coordinates of the center of a #graphene_box_t.
		 * @returns return location for the coordinates of
		 *   the center
		 */
		public get_center(): Point3D;
		/**
		 * Retrieves the size of the #box on the Z axis.
		 * @returns the depth of the box
		 */
		public get_depth(): number;
		/**
		 * Retrieves the size of the #box on the Y axis.
		 * @returns the height of the box
		 */
		public get_height(): number;
		/**
		 * Retrieves the coordinates of the maximum point of the given
		 * #graphene_box_t.
		 * @returns return location for the maximum point
		 */
		public get_max(): Point3D;
		/**
		 * Retrieves the coordinates of the minimum point of the given
		 * #graphene_box_t.
		 * @returns return location for the minimum point
		 */
		public get_min(): Point3D;
		/**
		 * Retrieves the size of the box on all three axes, and stores
		 * it into the given #size vector.
		 * @returns return location for the size
		 */
		public get_size(): Vec3;
		/**
		 * Computes the vertices of the given #graphene_box_t.
		 * @returns return location for an array
		 *   of 8 #graphene_vec3_t
		 */
		public get_vertices(): Vec3[];
		/**
		 * Retrieves the size of the #box on the X axis.
		 * @returns the width of the box
		 */
		public get_width(): number;
		/**
		 * Initializes the given #graphene_box_t with two vertices.
		 * @param min the coordinates of the minimum vertex
		 * @param max the coordinates of the maximum vertex
		 * @returns the initialized #graphene_box_t
		 */
		public init(min?: Point3D | null, max?: Point3D | null): Box;
		/**
		 * Initializes the given #graphene_box_t with the vertices of
		 * another #graphene_box_t.
		 * @param src a #graphene_box_t
		 * @returns the initialized #graphene_box_t
		 */
		public init_from_box(src: Box): Box;
		/**
		 * Initializes the given #graphene_box_t with the given array
		 * of vertices.
		 * 
		 * If #n_points is 0, the returned box is initialized with
		 * {@link Graphene.box.empty}.
		 * @param points an array of #graphene_point3d_t
		 * @returns the initialized #graphene_box_t
		 */
		public init_from_points(points: Point3D[]): Box;
		/**
		 * Initializes the given #graphene_box_t with two vertices
		 * stored inside #graphene_vec3_t.
		 * @param min the coordinates of the minimum vertex
		 * @param max the coordinates of the maximum vertex
		 * @returns the initialized #graphene_box_t
		 */
		public init_from_vec3(min?: Vec3 | null, max?: Vec3 | null): Box;
		/**
		 * Initializes the given #graphene_box_t with the given array
		 * of vertices.
		 * 
		 * If #n_vectors is 0, the returned box is initialized with
		 * {@link Graphene.box.empty}.
		 * @param vectors an array of #graphene_vec3_t
		 * @returns the initialized #graphene_box_t
		 */
		public init_from_vectors(vectors: Vec3[]): Box;
		/**
		 * Intersects the two given #graphene_box_t.
		 * 
		 * If the two boxes do not intersect, #res will contain a degenerate box
		 * initialized with {@link Graphene.box.empty}.
		 * @param b a #graphene_box_t
		 * @returns true if the two boxes intersect
		 * 
		 * return location for the result
		 */
		public intersection(b: Box): [ boolean, Box | null ];
		/**
		 * Unions the two given #graphene_box_t.
		 * @param b the box to union to #a
		 * @returns return location for the result
		 */
		public union(b: Box): Box;
	}

	export interface EulerInitOptions {}
	/**
	 * Describe a rotation using Euler angles.
	 * 
	 * The contents of the #graphene_euler_t structure are private
	 * and should never be accessed directly.
	 */
	interface Euler {}
	class Euler {
		public constructor(options?: Partial<EulerInitOptions>);
		/**
		 * Allocates a new #graphene_euler_t.
		 * 
		 * The contents of the returned structure are undefined.
		 * @returns the newly allocated #graphene_euler_t
		 */
		public static alloc(): Euler;
		public readonly angles: Vec3;
		public readonly order: EulerOrder;
		/**
		 * Checks if two #graphene_euler_t are equal.
		 * @param b a #graphene_euler_t
		 * @returns `true` if the two #graphene_euler_t are equal
		 */
		public equal(b: Euler): boolean;
		/**
		 * Frees the resources allocated by {@link Graphene.Euler.alloc}.
		 */
		public free(): void;
		/**
		 * Retrieves the first component of the Euler angle vector,
		 * depending on the order of rotation.
		 * 
		 * See also: {@link Graphene.Euler.get_x}
		 * @returns the first component of the Euler angle vector, in radians
		 */
		public get_alpha(): number;
		/**
		 * Retrieves the second component of the Euler angle vector,
		 * depending on the order of rotation.
		 * 
		 * See also: {@link Graphene.Euler.get_y}
		 * @returns the second component of the Euler angle vector, in radians
		 */
		public get_beta(): number;
		/**
		 * Retrieves the third component of the Euler angle vector,
		 * depending on the order of rotation.
		 * 
		 * See also: {@link Graphene.Euler.get_z}
		 * @returns the third component of the Euler angle vector, in radians
		 */
		public get_gamma(): number;
		/**
		 * Retrieves the order used to apply the rotations described in the
		 * #graphene_euler_t structure, when converting to and from other
		 * structures, like #graphene_quaternion_t and #graphene_matrix_t.
		 * 
		 * This function does not return the %GRAPHENE_EULER_ORDER_DEFAULT
		 * enumeration value; it will return the effective order of rotation
		 * instead.
		 * @returns the order used to apply the rotations
		 */
		public get_order(): EulerOrder;
		/**
		 * Retrieves the rotation angle on the X axis, in degrees.
		 * @returns the rotation angle
		 */
		public get_x(): number;
		/**
		 * Retrieves the rotation angle on the Y axis, in degrees.
		 * @returns the rotation angle
		 */
		public get_y(): number;
		/**
		 * Retrieves the rotation angle on the Z axis, in degrees.
		 * @returns the rotation angle
		 */
		public get_z(): number;
		/**
		 * Initializes a #graphene_euler_t using the given angles.
		 * 
		 * The order of the rotations is %GRAPHENE_EULER_ORDER_DEFAULT.
		 * @param x rotation angle on the X axis, in degrees
		 * @param y rotation angle on the Y axis, in degrees
		 * @param z rotation angle on the Z axis, in degrees
		 * @returns the initialized #graphene_euler_t
		 */
		public init(x: number, y: number, z: number): Euler;
		/**
		 * Initializes a #graphene_euler_t using the angles and order of
		 * another #graphene_euler_t.
		 * 
		 * If the #graphene_euler_t #src is %NULL, this function is equivalent
		 * to calling {@link Graphene.Euler.init} with all angles set to 0.
		 * @param src a #graphene_euler_t
		 * @returns the initialized #graphene_euler_t
		 */
		public init_from_euler(src?: Euler | null): Euler;
		/**
		 * Initializes a #graphene_euler_t using the given rotation matrix.
		 * 
		 * If the #graphene_matrix_t #m is %NULL, the #graphene_euler_t will
		 * be initialized with all angles set to 0.
		 * @param m a rotation matrix
		 * @param order the order used to apply the rotations
		 * @returns the initialized #graphene_euler_t
		 */
		public init_from_matrix(m: Matrix | null, order: EulerOrder): Euler;
		/**
		 * Initializes a #graphene_euler_t using the given normalized quaternion.
		 * 
		 * If the #graphene_quaternion_t #q is %NULL, the #graphene_euler_t will
		 * be initialized with all angles set to 0.
		 * @param q a normalized #graphene_quaternion_t
		 * @param order the order used to apply the rotations
		 * @returns the initialized #graphene_euler_t
		 */
		public init_from_quaternion(q: Quaternion | null, order: EulerOrder): Euler;
		/**
		 * Initializes a #graphene_euler_t using the given angles
		 * and order of rotation.
		 * @param x rotation angle on the X axis, in radians
		 * @param y rotation angle on the Y axis, in radians
		 * @param z rotation angle on the Z axis, in radians
		 * @param order order of rotations
		 * @returns the initialized #graphene_euler_t
		 */
		public init_from_radians(x: number, y: number, z: number, order: EulerOrder): Euler;
		/**
		 * Initializes a #graphene_euler_t using the angles contained in a
		 * #graphene_vec3_t.
		 * 
		 * If the #graphene_vec3_t #v is %NULL, the #graphene_euler_t will be
		 * initialized with all angles set to 0.
		 * @param v a #graphene_vec3_t containing the rotation
		 *   angles in degrees
		 * @param order the order used to apply the rotations
		 * @returns the initialized #graphene_euler_t
		 */
		public init_from_vec3(v: Vec3 | null, order: EulerOrder): Euler;
		/**
		 * Initializes a #graphene_euler_t with the given angles and #order.
		 * @param x rotation angle on the X axis, in degrees
		 * @param y rotation angle on the Y axis, in degrees
		 * @param z rotation angle on the Z axis, in degrees
		 * @param order the order used to apply the rotations
		 * @returns the initialized #graphene_euler_t
		 */
		public init_with_order(x: number, y: number, z: number, order: EulerOrder): Euler;
		/**
		 * Reorders a #graphene_euler_t using #order.
		 * 
		 * This function is equivalent to creating a #graphene_quaternion_t from the
		 * given #graphene_euler_t, and then converting the quaternion into another
		 * #graphene_euler_t.
		 * @param order the new order
		 * @returns return location for the reordered
		 *   #graphene_euler_t
		 */
		public reorder(order: EulerOrder): Euler;
		/**
		 * Converts a #graphene_euler_t into a transformation matrix expressing
		 * the extrinsic composition of rotations described by the Euler angles.
		 * 
		 * The rotations are applied over the reference frame axes in the order
		 * associated with the #graphene_euler_t; for instance, if the order
		 * used to initialize #e is %GRAPHENE_EULER_ORDER_XYZ:
		 * 
		 *  * the first rotation moves the body around the X axis with
		 *    an angle φ
		 *  * the second rotation moves the body around the Y axis with
		 *    an angle of ϑ
		 *  * the third rotation moves the body around the Z axis with
		 *    an angle of ψ
		 * 
		 * The rotation sign convention is right-handed, to preserve compatibility
		 * between Euler-based, quaternion-based, and angle-axis-based rotations.
		 * @returns return location for a #graphene_matrix_t
		 */
		public to_matrix(): Matrix;
		/**
		 * Converts a #graphene_euler_t into a #graphene_quaternion_t.
		 * @returns return location for a #graphene_quaternion_t
		 */
		public to_quaternion(): Quaternion;
		/**
		 * Retrieves the angles of a #graphene_euler_t and initializes a
		 * #graphene_vec3_t with them.
		 * @returns return location for a #graphene_vec3_t
		 */
		public to_vec3(): Vec3;
	}

	export interface FrustumInitOptions {}
	/**
	 * A 3D volume delimited by 2D clip planes.
	 * 
	 * The contents of the `graphene_frustum_t` are private, and should not be
	 * modified directly.
	 */
	interface Frustum {}
	class Frustum {
		public constructor(options?: Partial<FrustumInitOptions>);
		/**
		 * Allocates a new #graphene_frustum_t structure.
		 * 
		 * The contents of the returned structure are undefined.
		 * @returns the newly allocated #graphene_frustum_t
		 *   structure. Use {@link Graphene.Frustum.free} to free the resources
		 *   allocated by this function.
		 */
		public static alloc(): Frustum;
		public readonly planes: Plane[];
		/**
		 * Checks whether a point is inside the volume defined by the given
		 * #graphene_frustum_t.
		 * @param point a #graphene_point3d_t
		 * @returns `true` if the point is inside the frustum
		 */
		public contains_point(point: Point3D): boolean;
		/**
		 * Checks whether the two given #graphene_frustum_t are equal.
		 * @param b a #graphene_frustum_t
		 * @returns `true` if the given frustums are equal
		 */
		public equal(b: Frustum): boolean;
		/**
		 * Frees the resources allocated by {@link Graphene.Frustum.alloc}.
		 */
		public free(): void;
		/**
		 * Retrieves the planes that define the given #graphene_frustum_t.
		 * @returns return location for an array
		 *   of 6 #graphene_plane_t
		 */
		public get_planes(): Plane[];
		/**
		 * Initializes the given #graphene_frustum_t using the provided
		 * clipping planes.
		 * @param p0 a clipping plane
		 * @param p1 a clipping plane
		 * @param p2 a clipping plane
		 * @param p3 a clipping plane
		 * @param p4 a clipping plane
		 * @param p5 a clipping plane
		 * @returns the initialized frustum
		 */
		public init(p0: Plane, p1: Plane, p2: Plane, p3: Plane, p4: Plane, p5: Plane): Frustum;
		/**
		 * Initializes the given #graphene_frustum_t using the clipping
		 * planes of another #graphene_frustum_t.
		 * @param src a #graphene_frustum_t
		 * @returns the initialized frustum
		 */
		public init_from_frustum(src: Frustum): Frustum;
		/**
		 * Initializes a #graphene_frustum_t using the given #matrix.
		 * @param matrix a #graphene_matrix_t
		 * @returns the initialized frustum
		 */
		public init_from_matrix(matrix: Matrix): Frustum;
		/**
		 * Checks whether the given #box intersects a plane of
		 * a #graphene_frustum_t.
		 * @param box a #graphene_box_t
		 * @returns `true` if the box intersects the frustum
		 */
		public intersects_box(box: Box): boolean;
		/**
		 * Checks whether the given #sphere intersects a plane of
		 * a #graphene_frustum_t.
		 * @param sphere a #graphene_sphere_t
		 * @returns `true` if the sphere intersects the frustum
		 */
		public intersects_sphere(sphere: Sphere): boolean;
	}

	export interface MatrixInitOptions {}
	/**
	 * A structure capable of holding a 4x4 matrix.
	 * 
	 * The contents of the #graphene_matrix_t structure are private and
	 * should never be accessed directly.
	 */
	interface Matrix {}
	class Matrix {
		public constructor(options?: Partial<MatrixInitOptions>);
		/**
		 * Allocates a new #graphene_matrix_t.
		 * @returns the newly allocated matrix
		 */
		public static alloc(): Matrix;
		public readonly value: Simd4X4F;
		/**
		 * Decomposes a transformation matrix into its component transformations.
		 * 
		 * The algorithm for decomposing a matrix is taken from the
		 * [CSS3 Transforms specification](http://dev.w3.org/csswg/css-transforms/);
		 * specifically, the decomposition code is based on the equivalent code
		 * published in "Graphics Gems II", edited by Jim Arvo, and
		 * [available online](http://tog.acm.org/resources/GraphicsGems/gemsii/unmatrix.c).
		 * @returns `true` if the matrix could be decomposed
		 * 
		 * the translation vector
		 * 
		 * the scale vector
		 * 
		 * the rotation quaternion
		 * 
		 * the shear vector
		 * 
		 * the perspective vector
		 */
		public decompose(): [ boolean, Vec3, Vec3, Quaternion, Vec3, Vec4 ];
		/**
		 * Computes the determinant of the given matrix.
		 * @returns the value of the determinant
		 */
		public determinant(): number;
		/**
		 * Checks whether the two given #graphene_matrix_t matrices are equal.
		 * @param b a #graphene_matrix_t
		 * @returns `true` if the two matrices are equal, and `false` otherwise
		 */
		public equal(b: Matrix): boolean;
		/**
		 * Checks whether the two given #graphene_matrix_t matrices are
		 * byte-by-byte equal.
		 * 
		 * While this function is faster than {@link Graphene.Matrix.equal}, it
		 * can also return false negatives, so it should be used in
		 * conjuction with either graphene_matrix_equal() or
		 * graphene_matrix_near(). For instance:
		 * 
		 * |[<!-- language="C" -->
		 *   if (graphene_matrix_equal_fast (a, b))
		 *     {
		 *       // matrices are definitely the same
		 *     }
		 *   else
		 *     {
		 *       if (graphene_matrix_equal (a, b))
		 *         // matrices contain the same values within an epsilon of FLT_EPSILON
		 *       else if (graphene_matrix_near (a, b, 0.0001))
		 *         // matrices contain the same values within an epsilon of 0.0001
		 *       else
		 *         // matrices are not equal
		 *     }
		 * ]|
		 * @param b a #graphene_matrix_t
		 * @returns `true` if the matrices are equal. and `false` otherwise
		 */
		public equal_fast(b: Matrix): boolean;
		/**
		 * Frees the resources allocated by {@link Graphene.Matrix.alloc}.
		 */
		public free(): void;
		/**
		 * Retrieves the given row vector at #index_ inside a matrix.
		 * @param index_ the index of the row vector, between 0 and 3
		 * @returns return location for the #graphene_vec4_t
		 *   that is used to store the row vector
		 */
		public get_row(index_: number): Vec4;
		/**
		 * Retrieves the value at the given #row and #col index.
		 * @param row the row index
		 * @param col the column index
		 * @returns the value at the given indices
		 */
		public get_value(row: number, col: number): number;
		/**
		 * Retrieves the scaling factor on the X axis in #m.
		 * @returns the value of the scaling factor
		 */
		public get_x_scale(): number;
		/**
		 * Retrieves the translation component on the X axis from #m.
		 * @returns the translation component
		 */
		public get_x_translation(): number;
		/**
		 * Retrieves the scaling factor on the Y axis in #m.
		 * @returns the value of the scaling factor
		 */
		public get_y_scale(): number;
		/**
		 * Retrieves the translation component on the Y axis from #m.
		 * @returns the translation component
		 */
		public get_y_translation(): number;
		/**
		 * Retrieves the scaling factor on the Z axis in #m.
		 * @returns the value of the scaling factor
		 */
		public get_z_scale(): number;
		/**
		 * Retrieves the translation component on the Z axis from #m.
		 * @returns the translation component
		 */
		public get_z_translation(): number;
		/**
		 * Initializes a #graphene_matrix_t from the values of an affine
		 * transformation matrix.
		 * 
		 * The arguments map to the following matrix layout:
		 * 
		 * |[<!-- language="plain" -->
		 *   ⎛ xx  yx ⎞   ⎛  a   b  0 ⎞
		 *   ⎜ xy  yy ⎟ = ⎜  c   d  0 ⎟
		 *   ⎝ x0  y0 ⎠   ⎝ tx  ty  1 ⎠
		 * ]|
		 * 
		 * This function can be used to convert between an affine matrix type
		 * from other libraries and a #graphene_matrix_t.
		 * @param xx the xx member
		 * @param yx the yx member
		 * @param xy the xy member
		 * @param yy the yy member
		 * @param x_0 the x0 member
		 * @param y_0 the y0 member
		 * @returns the initialized matrix
		 */
		public init_from_2d(xx: number, yx: number, xy: number, yy: number, x_0: number, y_0: number): Matrix;
		/**
		 * Initializes a #graphene_matrix_t with the given array of floating
		 * point values.
		 * @param v an array of at least 16 floating
		 *   point values
		 * @returns the initialized matrix
		 */
		public init_from_float(v: number[]): Matrix;
		/**
		 * Initializes a #graphene_matrix_t using the values of the
		 * given matrix.
		 * @param src a #graphene_matrix_t
		 * @returns the initialized matrix
		 */
		public init_from_matrix(src: Matrix): Matrix;
		/**
		 * Initializes a #graphene_matrix_t with the given four row
		 * vectors.
		 * @param v0 the first row vector
		 * @param v1 the second row vector
		 * @param v2 the third row vector
		 * @param v3 the fourth row vector
		 * @returns the initialized matrix
		 */
		public init_from_vec4(v0: Vec4, v1: Vec4, v2: Vec4, v3: Vec4): Matrix;
		/**
		 * Initializes a #graphene_matrix_t compatible with #graphene_frustum_t.
		 * 
		 * See also: {@link Graphene.Frustum.init_from_matrix}
		 * @param left distance of the left clipping plane
		 * @param right distance of the right clipping plane
		 * @param bottom distance of the bottom clipping plane
		 * @param top distance of the top clipping plane
		 * @param z_near distance of the near clipping plane
		 * @param z_far distance of the far clipping plane
		 * @returns the initialized matrix
		 */
		public init_frustum(left: number, right: number, bottom: number, top: number, z_near: number, z_far: number): Matrix;
		/**
		 * Initializes a #graphene_matrix_t with the identity matrix.
		 * @returns the initialized matrix
		 */
		public init_identity(): Matrix;
		/**
		 * Initializes a #graphene_matrix_t so that it positions the "camera"
		 * at the given #eye coordinates towards an object at the #center
		 * coordinates. The top of the camera is aligned to the direction
		 * of the #up vector.
		 * 
		 * Before the transform, the camera is assumed to be placed at the
		 * origin, looking towards the negative Z axis, with the top side of
		 * the camera facing in the direction of the Y axis and the right
		 * side in the direction of the X axis.
		 * 
		 * In theory, one could use #m to transform a model of such a camera
		 * into world-space. However, it is more common to use the inverse of
		 * #m to transform another object from world coordinates to the view
		 * coordinates of the camera. Typically you would then apply the
		 * camera projection transform to get from view to screen
		 * coordinates.
		 * @param eye the vector describing the position to look from
		 * @param center the vector describing the position to look at
		 * @param up the vector describing the world's upward direction; usually,
		 *   this is the {@link Graphene.vec3.y_axis} vector
		 * @returns the initialized matrix
		 */
		public init_look_at(eye: Vec3, center: Vec3, up: Vec3): Matrix;
		/**
		 * Initializes a #graphene_matrix_t with an orthographic projection.
		 * @param left the left edge of the clipping plane
		 * @param right the right edge of the clipping plane
		 * @param top the top edge of the clipping plane
		 * @param bottom the bottom edge of the clipping plane
		 * @param z_near the distance of the near clipping plane
		 * @param z_far the distance of the far clipping plane
		 * @returns the initialized matrix
		 */
		public init_ortho(left: number, right: number, top: number, bottom: number, z_near: number, z_far: number): Matrix;
		/**
		 * Initializes a #graphene_matrix_t with a perspective projection.
		 * @param fovy the field of view angle, in degrees
		 * @param aspect the aspect value
		 * @param z_near the near Z plane
		 * @param z_far the far Z plane
		 * @returns the initialized matrix
		 */
		public init_perspective(fovy: number, aspect: number, z_near: number, z_far: number): Matrix;
		/**
		 * Initializes #m to represent a rotation of #angle degrees on
		 * the axis represented by the #axis vector.
		 * @param angle the rotation angle, in degrees
		 * @param axis the axis vector as a #graphene_vec3_t
		 * @returns the initialized matrix
		 */
		public init_rotate(angle: number, axis: Vec3): Matrix;
		/**
		 * Initializes a #graphene_matrix_t with the given scaling factors.
		 * @param x the scale factor on the X axis
		 * @param y the scale factor on the Y axis
		 * @param z the scale factor on the Z axis
		 * @returns the initialized matrix
		 */
		public init_scale(x: number, y: number, z: number): Matrix;
		/**
		 * Initializes a #graphene_matrix_t with a skew transformation
		 * with the given factors.
		 * @param x_skew skew factor, in radians, on the X axis
		 * @param y_skew skew factor, in radians, on the Y axis
		 * @returns the initialized matrix
		 */
		public init_skew(x_skew: number, y_skew: number): Matrix;
		/**
		 * Initializes a #graphene_matrix_t with a translation to the
		 * given coordinates.
		 * @param p the translation coordinates
		 * @returns the initialized matrix
		 */
		public init_translate(p: Point3D): Matrix;
		/**
		 * Linearly interpolates the two given #graphene_matrix_t by
		 * interpolating the decomposed transformations separately.
		 * 
		 * If either matrix cannot be reduced to their transformations
		 * then the interpolation cannot be performed, and this function
		 * will return an identity matrix.
		 * @param b a #graphene_matrix_t
		 * @param factor the linear interpolation factor
		 * @returns return location for the
		 *   interpolated matrix
		 */
		public interpolate(b: Matrix, factor: number): Matrix;
		/**
		 * Inverts the given matrix.
		 * @returns `true` if the matrix is invertible
		 * 
		 * return location for the
		 *   inverse matrix
		 */
		public inverse(): [ boolean, Matrix ];
		/**
		 * Checks whether the given #graphene_matrix_t is compatible with an
		 * a 2D affine transformation matrix.
		 * @returns `true` if the matrix is compatible with an affine
		 *   transformation matrix
		 */
		public is_2d(): boolean;
		/**
		 * Checks whether a #graphene_matrix_t has a visible back face.
		 * @returns `true` if the back face of the matrix is visible
		 */
		public is_backface_visible(): boolean;
		/**
		 * Checks whether the given #graphene_matrix_t is the identity matrix.
		 * @returns `true` if the matrix is the identity matrix
		 */
		public is_identity(): boolean;
		/**
		 * Checks whether a matrix is singular.
		 * @returns `true` if the matrix is singular
		 */
		public is_singular(): boolean;
		/**
		 * Multiplies two #graphene_matrix_t.
		 * 
		 * Matrix multiplication is not commutative in general; the order of the factors matters.
		 * The product of this multiplication is (#a × #b)
		 * @param b a #graphene_matrix_t
		 * @returns return location for the matrix
		 *   result
		 */
		public multiply(b: Matrix): Matrix;
		/**
		 * Compares the two given #graphene_matrix_t matrices and checks
		 * whether their values are within the given #epsilon of each
		 * other.
		 * @param b a #graphene_matrix_t
		 * @param epsilon the threshold between the two matrices
		 * @returns `true` if the two matrices are near each other, and
		 *   `false` otherwise
		 */
		public near(b: Matrix, epsilon: number): boolean;
		/**
		 * Normalizes the given #graphene_matrix_t.
		 * @returns return location for the normalized matrix
		 */
		public normalize(): Matrix;
		/**
		 * Applies a perspective of #depth to the matrix.
		 * @param depth the depth of the perspective
		 * @returns return location for the
		 *   perspective matrix
		 */
		public perspective(depth: number): Matrix;
		/**
		 * Prints the contents of a matrix to the standard error stream.
		 * 
		 * This function is only useful for debugging; there are no guarantees
		 * made on the format of the output.
		 */
		public print(): void;
		/**
		 * Projects a #graphene_point_t using the matrix #m.
		 * @param p a #graphene_point_t
		 * @returns return location for the projected
		 *   point
		 */
		public project_point(p: Point): Point;
		/**
		 * Projects all corners of a #graphene_rect_t using the given matrix.
		 * 
		 * See also: {@link Graphene.Matrix.project_point}
		 * @param r a #graphene_rect_t
		 * @returns return location for the projected
		 *   rectangle
		 */
		public project_rect(r: Rect): Quad;
		/**
		 * Projects a #graphene_rect_t using the given matrix.
		 * 
		 * The resulting rectangle is the axis aligned bounding rectangle capable
		 * of fully containing the projected rectangle.
		 * @param r a #graphene_rect_t
		 * @returns return location for the projected
		 *   rectangle
		 */
		public project_rect_bounds(r: Rect): Rect;
		/**
		 * Adds a rotation transformation to #m, using the given #angle
		 * and #axis vector.
		 * 
		 * This is the equivalent of calling {@link Graphene.Matrix.init_rotate} and
		 * then multiplying the matrix #m with the rotation matrix.
		 * @param angle the rotation angle, in degrees
		 * @param axis the rotation axis, as a #graphene_vec3_t
		 */
		public rotate(angle: number, axis: Vec3): void;
		/**
		 * Adds a rotation transformation to #m, using the given
		 * #graphene_euler_t.
		 * @param e a rotation described by a #graphene_euler_t
		 */
		public rotate_euler(e: Euler): void;
		/**
		 * Adds a rotation transformation to #m, using the given
		 * #graphene_quaternion_t.
		 * 
		 * This is the equivalent of calling {@link Graphene.Quaternion.to_matrix} and
		 * then multiplying #m with the rotation matrix.
		 * @param q a rotation described by a #graphene_quaternion_t
		 */
		public rotate_quaternion(q: Quaternion): void;
		/**
		 * Adds a rotation transformation around the X axis to #m, using
		 * the given #angle.
		 * 
		 * See also: {@link Graphene.Matrix.rotate}
		 * @param angle the rotation angle, in degrees
		 */
		public rotate_x(angle: number): void;
		/**
		 * Adds a rotation transformation around the Y axis to #m, using
		 * the given #angle.
		 * 
		 * See also: {@link Graphene.Matrix.rotate}
		 * @param angle the rotation angle, in degrees
		 */
		public rotate_y(angle: number): void;
		/**
		 * Adds a rotation transformation around the Z axis to #m, using
		 * the given #angle.
		 * 
		 * See also: {@link Graphene.Matrix.rotate}
		 * @param angle the rotation angle, in degrees
		 */
		public rotate_z(angle: number): void;
		/**
		 * Adds a scaling transformation to #m, using the three
		 * given factors.
		 * 
		 * This is the equivalent of calling {@link Graphene.Matrix.init_scale} and then
		 * multiplying the matrix #m with the scale matrix.
		 * @param factor_x scaling factor on the X axis
		 * @param factor_y scaling factor on the Y axis
		 * @param factor_z scaling factor on the Z axis
		 */
		public scale(factor_x: number, factor_y: number, factor_z: number): void;
		/**
		 * Adds a skew of #factor on the X and Y axis to the given matrix.
		 * @param factor skew factor
		 */
		public skew_xy(factor: number): void;
		/**
		 * Adds a skew of #factor on the X and Z axis to the given matrix.
		 * @param factor skew factor
		 */
		public skew_xz(factor: number): void;
		/**
		 * Adds a skew of #factor on the Y and Z axis to the given matrix.
		 * @param factor skew factor
		 */
		public skew_yz(factor: number): void;
		/**
		 * Converts a #graphene_matrix_t to an affine transformation
		 * matrix, if the given matrix is compatible.
		 * 
		 * The returned values have the following layout:
		 * 
		 * |[<!-- language="plain" -->
		 *   ⎛ xx  yx ⎞   ⎛  a   b  0 ⎞
		 *   ⎜ xy  yy ⎟ = ⎜  c   d  0 ⎟
		 *   ⎝ x0  y0 ⎠   ⎝ tx  ty  1 ⎠
		 * ]|
		 * 
		 * This function can be used to convert between a #graphene_matrix_t
		 * and an affine matrix type from other libraries.
		 * @returns `true` if the matrix is compatible with an affine
		 *   transformation matrix
		 * 
		 * return location for the xx member
		 * 
		 * return location for the yx member
		 * 
		 * return location for the xy member
		 * 
		 * return location for the yy member
		 * 
		 * return location for the x0 member
		 * 
		 * return location for the y0 member
		 */
		public to_2d(): [ boolean, number, number, number, number, number, number ];
		/**
		 * Converts a #graphene_matrix_t to an array of floating point
		 * values.
		 * @returns return location
		 *   for an array of floating point values. The array must be capable
		 *   of holding at least 16 values.
		 */
		public to_float(): number[];
		/**
		 * Transforms each corner of a #graphene_rect_t using the given matrix #m.
		 * 
		 * The result is the axis aligned bounding rectangle containing the coplanar
		 * quadrilateral.
		 * 
		 * See also: {@link Graphene.Matrix.transform_point}
		 * @param r a #graphene_rect_t
		 * @returns return location for the bounds
		 *   of the transformed rectangle
		 */
		public transform_bounds(r: Rect): Rect;
		/**
		 * Transforms the vertices of a #graphene_box_t using the given matrix #m.
		 * 
		 * The result is the axis aligned bounding box containing the transformed
		 * vertices.
		 * @param b a #graphene_box_t
		 * @returns return location for the bounds
		 *   of the transformed box
		 */
		public transform_box(b: Box): Box;
		/**
		 * Transforms the given #graphene_point_t using the matrix #m.
		 * 
		 * Unlike {@link Graphene.Matrix.transform_vec3}, this function will take into
		 * account the fourth row vector of the #graphene_matrix_t when computing
		 * the dot product of each row vector of the matrix.
		 * 
		 * See also: graphene_simd4x4f_point3_mul()
		 * @param p a #graphene_point_t
		 * @returns return location for the
		 *   transformed #graphene_point_t
		 */
		public transform_point(p: Point): Point;
		/**
		 * Transforms the given #graphene_point3d_t using the matrix #m.
		 * 
		 * Unlike {@link Graphene.Matrix.transform_vec3}, this function will take into
		 * account the fourth row vector of the #graphene_matrix_t when computing
		 * the dot product of each row vector of the matrix.
		 * 
		 * See also: graphene_simd4x4f_point3_mul()
		 * @param p a #graphene_point3d_t
		 * @returns return location for the result
		 */
		public transform_point3d(p: Point3D): Point3D;
		/**
		 * Transform a #graphene_ray_t using the given matrix #m.
		 * @param r a #graphene_ray_t
		 * @returns return location for the
		 *   transformed ray
		 */
		public transform_ray(r: Ray): Ray;
		/**
		 * Transforms each corner of a #graphene_rect_t using the given matrix #m.
		 * 
		 * The result is a coplanar quadrilateral.
		 * 
		 * See also: {@link Graphene.Matrix.transform_point}
		 * @param r a #graphene_rect_t
		 * @returns return location for the
		 *   transformed quad
		 */
		public transform_rect(r: Rect): Quad;
		/**
		 * Transforms a #graphene_sphere_t using the given matrix #m. The
		 * result is the bounding sphere containing the transformed sphere.
		 * @param s a #graphene_sphere_t
		 * @returns return location for the bounds
		 *   of the transformed sphere
		 */
		public transform_sphere(s: Sphere): Sphere;
		/**
		 * Transforms the given #graphene_vec3_t using the matrix #m.
		 * 
		 * This function will multiply the X, Y, and Z row vectors of the matrix #m
		 * with the corresponding components of the vector #v. The W row vector will
		 * be ignored.
		 * 
		 * See also: {@link Graphene.Simd4X4F.vec3_mul}
		 * @param v a #graphene_vec3_t
		 * @returns return location for a #graphene_vec3_t
		 */
		public transform_vec3(v: Vec3): Vec3;
		/**
		 * Transforms the given #graphene_vec4_t using the matrix #m.
		 * 
		 * See also: {@link Graphene.Simd4X4F.vec4_mul}
		 * @param v a #graphene_vec4_t
		 * @returns return location for a #graphene_vec4_t
		 */
		public transform_vec4(v: Vec4): Vec4;
		/**
		 * Adds a translation transformation to #m using the coordinates
		 * of the given #graphene_point3d_t.
		 * 
		 * This is the equivalent of calling {@link Graphene.Matrix.init_translate} and
		 * then multiplying #m with the translation matrix.
		 * @param pos a #graphene_point3d_t
		 */
		public translate(pos: Point3D): void;
		/**
		 * Transposes the given matrix.
		 * @returns return location for the
		 *   transposed matrix
		 */
		public transpose(): Matrix;
		/**
		 * Unprojects the given #point using the #projection matrix and
		 * a #modelview matrix.
		 * @param modelview a #graphene_matrix_t for the modelview matrix; this is
		 *   the inverse of the modelview used when projecting the point
		 * @param point a #graphene_point3d_t with the coordinates of the point
		 * @returns return location for the unprojected
		 *   point
		 */
		public unproject_point3d(modelview: Matrix, point: Point3D): Point3D;
		/**
		 * Undoes the transformation on the corners of a #graphene_rect_t using the
		 * given matrix, within the given axis aligned rectangular #bounds.
		 * @param r a #graphene_rect_t
		 * @param bounds the bounds of the transformation
		 * @returns return location for the
		 *   untransformed rectangle
		 */
		public untransform_bounds(r: Rect, bounds: Rect): Rect;
		/**
		 * Undoes the transformation of a #graphene_point_t using the
		 * given matrix, within the given axis aligned rectangular #bounds.
		 * @param p a #graphene_point_t
		 * @param bounds the bounds of the transformation
		 * @returns `true` if the point was successfully untransformed
		 * 
		 * return location for the
		 *   untransformed point
		 */
		public untransform_point(p: Point, bounds: Rect): [ boolean, Point ];
	}

	export interface PlaneInitOptions {}
	/**
	 * A 2D plane that extends infinitely in a 3D volume.
	 * 
	 * The contents of the `graphene_plane_t` are private, and should not be
	 * modified directly.
	 */
	interface Plane {}
	class Plane {
		public constructor(options?: Partial<PlaneInitOptions>);
		/**
		 * Allocates a new #graphene_plane_t structure.
		 * 
		 * The contents of the returned structure are undefined.
		 * @returns the newly allocated #graphene_plane_t.
		 *   Use {@link Graphene.Plane.free} to free the resources allocated by
		 *   this function
		 */
		public static alloc(): Plane;
		public readonly normal: Vec3;
		public readonly constant: number;
		/**
		 * Computes the distance of #point from a #graphene_plane_t.
		 * @param point a #graphene_point3d_t
		 * @returns the distance of the given #graphene_point3d_t from the plane
		 */
		public distance(point: Point3D): number;
		/**
		 * Checks whether the two given #graphene_plane_t are equal.
		 * @param b a #graphene_plane_t
		 * @returns `true` if the given planes are equal
		 */
		public equal(b: Plane): boolean;
		/**
		 * Frees the resources allocated by {@link Graphene.Plane.alloc}.
		 */
		public free(): void;
		/**
		 * Retrieves the distance along the normal vector of the
		 * given #graphene_plane_t from the origin.
		 * @returns the constant value of the plane
		 */
		public get_constant(): number;
		/**
		 * Retrieves the normal vector pointing towards the origin of the
		 * given #graphene_plane_t.
		 * @returns return location for the normal vector
		 */
		public get_normal(): Vec3;
		/**
		 * Initializes the given #graphene_plane_t using the given #normal vector
		 * and #constant values.
		 * @param normal a unit length normal vector defining the plane
		 *   pointing towards the origin; if unset, we use the X axis by default
		 * @param constant the distance from the origin to the plane along the
		 *   normal vector; the sign determines the half-space occupied by the
		 *   plane
		 * @returns the initialized plane
		 */
		public init(normal: Vec3 | null, constant: number): Plane;
		/**
		 * Initializes the given #graphene_plane_t using the normal
		 * vector and constant of another #graphene_plane_t.
		 * @param src a #graphene_plane_t
		 * @returns the initialized plane
		 */
		public init_from_plane(src: Plane): Plane;
		/**
		 * Initializes the given #graphene_plane_t using the given normal vector
		 * and an arbitrary co-planar point.
		 * @param normal a normal vector defining the plane pointing towards the origin
		 * @param point a #graphene_point3d_t
		 * @returns the initialized plane
		 */
		public init_from_point(normal: Vec3, point: Point3D): Plane;
		/**
		 * Initializes the given #graphene_plane_t using the 3 provided co-planar
		 * points.
		 * 
		 * The winding order is counter-clockwise, and determines which direction
		 * the normal vector will point.
		 * @param a a #graphene_point3d_t
		 * @param b a #graphene_point3d_t
		 * @param c a #graphene_point3d_t
		 * @returns the initialized plane
		 */
		public init_from_points(a: Point3D, b: Point3D, c: Point3D): Plane;
		/**
		 * Initializes the given #graphene_plane_t using the components of
		 * the given #graphene_vec4_t vector.
		 * @param src a #graphene_vec4_t containing the normal vector in its first
		 *   three components, and the distance in its fourth component
		 * @returns the initialized plane
		 */
		public init_from_vec4(src: Vec4): Plane;
		/**
		 * Negates the normal vector and constant of a #graphene_plane_t, effectively
		 * mirroring the plane across the origin.
		 * @returns return location for the negated plane
		 */
		public negate(): Plane;
		/**
		 * Normalizes the vector of the given #graphene_plane_t,
		 * and adjusts the constant accordingly.
		 * @returns return location for the normalized plane
		 */
		public normalize(): Plane;
		/**
		 * Transforms a #graphene_plane_t #p using the given #matrix
		 * and #normal_matrix.
		 * 
		 * If #normal_matrix is %NULL, a transformation matrix for the plane
		 * normal will be computed from #matrix. If you are transforming
		 * multiple planes using the same #matrix it's recommended to compute
		 * the normal matrix beforehand to avoid incurring in the cost of
		 * recomputing it every time.
		 * @param matrix a #graphene_matrix_t
		 * @param normal_matrix a #graphene_matrix_t
		 * @returns the transformed plane
		 */
		public transform(matrix: Matrix, normal_matrix?: Matrix | null): Plane;
	}

	export interface PointInitOptions {}
	/**
	 * A point with two coordinates.
	 */
	interface Point {}
	class Point {
		public constructor(options?: Partial<PointInitOptions>);
		/**
		 * Allocates a new #graphene_point_t structure.
		 * 
		 * The coordinates of the returned point are (0, 0).
		 * 
		 * It's possible to chain this function with {@link Graphene.Point.init}
		 * or graphene_point_init_from_point(), e.g.:
		 * 
		 * |[<!-- language="C" -->
		 *   graphene_point_t *
		 *   point_new (float x, float y)
		 *   {
		 *     return graphene_point_init (graphene_point_alloc (), x, y);
		 *   }
		 * 
		 *   graphene_point_t *
		 *   point_copy (const graphene_point_t *p)
		 *   {
		 *     return graphene_point_init_from_point (graphene_point_alloc (), p);
		 *   }
		 * ]|
		 * @returns the newly allocated #graphene_point_t.
		 *   Use {@link Graphene.Point.free} to free the resources allocated by
		 *   this function.
		 */
		public static alloc(): Point;
		/**
		 * Returns a point fixed at (0, 0).
		 * @returns a fixed point
		 */
		public static zero(): Point;
		/**
		 * the X coordinate of the point
		 */
		public x: number;
		/**
		 * the Y coordinate of the point
		 */
		public y: number;
		/**
		 * Computes the distance between #a and #b.
		 * @param b a #graphene_point_t
		 * @returns the distance between the two points
		 * 
		 * distance component on the X axis
		 * 
		 * distance component on the Y axis
		 */
		public distance(b: Point): [ number, number | null, number | null ];
		/**
		 * Checks if the two points #a and #b point to the same
		 * coordinates.
		 * 
		 * This function accounts for floating point fluctuations; if
		 * you want to control the fuzziness of the match, you can use
		 * {@link Graphene.Point.near} instead.
		 * @param b a #graphene_point_t
		 * @returns `true` if the points have the same coordinates
		 */
		public equal(b: Point): boolean;
		/**
		 * Frees the resources allocated by {@link Graphene.Point.alloc}.
		 */
		public free(): void;
		/**
		 * Initializes #p to the given #x and #y coordinates.
		 * 
		 * It's safe to call this function multiple times.
		 * @param x the X coordinate
		 * @param y the Y coordinate
		 * @returns the initialized point
		 */
		public init(x: number, y: number): Point;
		/**
		 * Initializes #p with the same coordinates of #src.
		 * @param src the #graphene_point_t to use
		 * @returns the initialized point
		 */
		public init_from_point(src: Point): Point;
		/**
		 * Initializes #p with the coordinates inside the given #graphene_vec2_t.
		 * @param src a #graphene_vec2_t
		 * @returns the initialized point
		 */
		public init_from_vec2(src: Vec2): Point;
		/**
		 * Linearly interpolates the coordinates of #a and #b using the
		 * given #factor.
		 * @param b a #graphene_point_t
		 * @param factor the linear interpolation factor
		 * @returns return location for the interpolated
		 *   point
		 */
		public interpolate(b: Point, factor: number): Point;
		/**
		 * Checks whether the two points #a and #b are within
		 * the threshold of #epsilon.
		 * @param b a #graphene_point_t
		 * @param epsilon threshold between the two points
		 * @returns `true` if the distance is within #epsilon
		 */
		public near(b: Point, epsilon: number): boolean;
		/**
		 * Stores the coordinates of the given #graphene_point_t into a
		 * #graphene_vec2_t.
		 * @returns return location for the vertex
		 */
		public to_vec2(): Vec2;
	}

	export interface Point3DInitOptions {}
	/**
	 * A point with three components: X, Y, and Z.
	 */
	interface Point3D {}
	class Point3D {
		public constructor(options?: Partial<Point3DInitOptions>);
		/**
		 * Allocates a #graphene_point3d_t structure.
		 * @returns the newly allocated structure.
		 *   Use {@link Graphene.Point3D.free} to free the resources
		 *   allocated by this function.
		 */
		public static alloc(): Point3D;
		/**
		 * Retrieves a constant point with all three coordinates set to 0.
		 * @returns a zero point
		 */
		public static zero(): Point3D;
		/**
		 * the X coordinate
		 */
		public x: number;
		/**
		 * the Y coordinate
		 */
		public y: number;
		/**
		 * the Z coordinate
		 */
		public z: number;
		/**
		 * Computes the cross product of the two given #graphene_point3d_t.
		 * @param b a #graphene_point3d_t
		 * @returns return location for the cross
		 *   product
		 */
		public cross(b: Point3D): Point3D;
		/**
		 * Computes the distance between the two given #graphene_point3d_t.
		 * @param b a #graphene_point3d_t
		 * @returns the distance between two points
		 * 
		 * return location for the distance
		 *   components on the X, Y, and Z axis
		 */
		public distance(b: Point3D): [ number, Vec3 | null ];
		/**
		 * Computes the dot product of the two given #graphene_point3d_t.
		 * @param b a #graphene_point3d_t
		 * @returns the value of the dot product
		 */
		public dot(b: Point3D): number;
		/**
		 * Checks whether two given points are equal.
		 * @param b a #graphene_point3d_t
		 * @returns `true` if the points are equal
		 */
		public equal(b: Point3D): boolean;
		/**
		 * Frees the resources allocated via {@link Graphene.Point3D.alloc}.
		 */
		public free(): void;
		/**
		 * Initializes a #graphene_point3d_t with the given coordinates.
		 * @param x the X coordinate of the point
		 * @param y the Y coordinate of the point
		 * @param z the Z coordinate of the point
		 * @returns the initialized #graphene_point3d_t
		 */
		public init(x: number, y: number, z: number): Point3D;
		/**
		 * Initializes a #graphene_point3d_t using the coordinates of
		 * another #graphene_point3d_t.
		 * @param src a #graphene_point3d_t
		 * @returns the initialized point
		 */
		public init_from_point(src: Point3D): Point3D;
		/**
		 * Initializes a #graphene_point3d_t using the components
		 * of a #graphene_vec3_t.
		 * @param v a #graphene_vec3_t
		 * @returns the initialized #graphene_point3d_t
		 */
		public init_from_vec3(v: Vec3): Point3D;
		/**
		 * Linearly interpolates each component of #a and #b using the
		 * provided #factor, and places the result in #res.
		 * @param b a #graphene_point3d_t
		 * @param factor the interpolation factor
		 * @returns the return location for the
		 *   interpolated #graphene_point3d_t
		 */
		public interpolate(b: Point3D, factor: number): Point3D;
		/**
		 * Computes the length of the vector represented by the
		 * coordinates of the given #graphene_point3d_t.
		 * @returns the length of the vector represented by the point
		 */
		public length(): number;
		/**
		 * Checks whether the two points are near each other, within
		 * an #epsilon factor.
		 * @param b a #graphene_point3d_t
		 * @param epsilon fuzzyness factor
		 * @returns `true` if the points are near each other
		 */
		public near(b: Point3D, epsilon: number): boolean;
		/**
		 * Computes the normalization of the vector represented by the
		 * coordinates of the given #graphene_point3d_t.
		 * @returns return location for the normalized
		 *   #graphene_point3d_t
		 */
		public normalize(): Point3D;
		/**
		 * Normalizes the coordinates of a #graphene_point3d_t using the
		 * given viewport and clipping planes.
		 * 
		 * The coordinates of the resulting #graphene_point3d_t will be
		 * in the [ -1, 1 ] range.
		 * @param viewport a #graphene_rect_t representing a viewport
		 * @param z_near the coordinate of the near clipping plane, or 0 for
		 *   the default near clipping plane
		 * @param z_far the coordinate of the far clipping plane, or 1 for the
		 *   default far clipping plane
		 * @returns the return location for the
		 *   normalized #graphene_point3d_t
		 */
		public normalize_viewport(viewport: Rect, z_near: number, z_far: number): Point3D;
		/**
		 * Scales the coordinates of the given #graphene_point3d_t by
		 * the given #factor.
		 * @param factor the scaling factor
		 * @returns return location for the scaled point
		 */
		public scale(factor: number): Point3D;
		/**
		 * Stores the coordinates of a #graphene_point3d_t into a
		 * #graphene_vec3_t.
		 * @returns return location for a #graphene_vec3_t
		 */
		public to_vec3(): Vec3;
	}

	export interface QuadInitOptions {}
	/**
	 * A 4 vertex quadrilateral, as represented by four #graphene_point_t.
	 * 
	 * The contents of a #graphene_quad_t are private and should never be
	 * accessed directly.
	 */
	interface Quad {}
	class Quad {
		public constructor(options?: Partial<QuadInitOptions>);
		/**
		 * Allocates a new #graphene_quad_t instance.
		 * 
		 * The contents of the returned instance are undefined.
		 * @returns the newly created #graphene_quad_t instance
		 */
		public static alloc(): Quad;
		public readonly points: Point[];
		/**
		 * Computes the bounding rectangle of #q and places it into #r.
		 * @returns return location for a #graphene_rect_t
		 */
		public bounds(): Rect;
		/**
		 * Checks if the given #graphene_quad_t contains the given #graphene_point_t.
		 * @param p a #graphene_point_t
		 * @returns `true` if the point is inside the #graphene_quad_t
		 */
		public contains(p: Point): boolean;
		/**
		 * Frees the resources allocated by {@link Graphene.Quad.alloc}
		 */
		public free(): void;
		/**
		 * Retrieves the point of a #graphene_quad_t at the given index.
		 * @param index_ the index of the point to retrieve
		 * @returns a #graphene_point_t
		 */
		public get_point(index_: number): Point;
		/**
		 * Initializes a #graphene_quad_t with the given points.
		 * @param p1 the first point of the quadrilateral
		 * @param p2 the second point of the quadrilateral
		 * @param p3 the third point of the quadrilateral
		 * @param p4 the fourth point of the quadrilateral
		 * @returns the initialized #graphene_quad_t
		 */
		public init(p1: Point, p2: Point, p3: Point, p4: Point): Quad;
		/**
		 * Initializes a #graphene_quad_t using an array of points.
		 * @param points an array of 4 #graphene_point_t
		 * @returns the initialized #graphene_quad_t
		 */
		public init_from_points(points: Point[]): Quad;
		/**
		 * Initializes a #graphene_quad_t using the four corners of the
		 * given #graphene_rect_t.
		 * @param r a #graphene_rect_t
		 * @returns the initialized #graphene_quad_t
		 */
		public init_from_rect(r: Rect): Quad;
	}

	export interface QuaternionInitOptions {}
	/**
	 * A quaternion.
	 * 
	 * The contents of the #graphene_quaternion_t structure are private
	 * and should never be accessed directly.
	 */
	interface Quaternion {}
	class Quaternion {
		public constructor(options?: Partial<QuaternionInitOptions>);
		/**
		 * Allocates a new #graphene_quaternion_t.
		 * 
		 * The contents of the returned value are undefined.
		 * @returns the newly allocated #graphene_quaternion_t
		 */
		public static alloc(): Quaternion;
		public readonly x: number;
		public readonly y: number;
		public readonly z: number;
		public readonly w: number;
		/**
		 * Adds two #graphene_quaternion_t #a and #b.
		 * @param b a #graphene_quaternion_t
		 * @returns the result of the operation
		 */
		public add(b: Quaternion): Quaternion;
		/**
		 * Computes the dot product of two #graphene_quaternion_t.
		 * @param b a #graphene_quaternion_t
		 * @returns the value of the dot products
		 */
		public dot(b: Quaternion): number;
		/**
		 * Checks whether the given quaternions are equal.
		 * @param b a #graphene_quaternion_t
		 * @returns `true` if the quaternions are equal
		 */
		public equal(b: Quaternion): boolean;
		/**
		 * Releases the resources allocated by {@link Graphene.Quaternion.alloc}.
		 */
		public free(): void;
		/**
		 * Initializes a #graphene_quaternion_t using the given four values.
		 * @param x the first component of the quaternion
		 * @param y the second component of the quaternion
		 * @param z the third component of the quaternion
		 * @param w the fourth component of the quaternion
		 * @returns the initialized quaternion
		 */
		public init(x: number, y: number, z: number, w: number): Quaternion;
		/**
		 * Initializes a #graphene_quaternion_t using an #angle on a
		 * specific #axis.
		 * @param angle the rotation on a given axis, in degrees
		 * @param axis the axis of rotation, expressed as a vector
		 * @returns the initialized quaternion
		 */
		public init_from_angle_vec3(angle: number, axis: Vec3): Quaternion;
		/**
		 * Initializes a #graphene_quaternion_t using the values of
		 * the [Euler angles](http://en.wikipedia.org/wiki/Euler_angles)
		 * on each axis.
		 * 
		 * See also: {@link Graphene.Quaternion.init_from_euler}
		 * @param deg_x rotation angle on the X axis (yaw), in degrees
		 * @param deg_y rotation angle on the Y axis (pitch), in degrees
		 * @param deg_z rotation angle on the Z axis (roll), in degrees
		 * @returns the initialized quaternion
		 */
		public init_from_angles(deg_x: number, deg_y: number, deg_z: number): Quaternion;
		/**
		 * Initializes a #graphene_quaternion_t using the given #graphene_euler_t.
		 * @param e a #graphene_euler_t
		 * @returns the initialized #graphene_quaternion_t
		 */
		public init_from_euler(e: Euler): Quaternion;
		/**
		 * Initializes a #graphene_quaternion_t using the rotation components
		 * of a transformation matrix.
		 * @param m a #graphene_matrix_t
		 * @returns the initialized quaternion
		 */
		public init_from_matrix(m: Matrix): Quaternion;
		/**
		 * Initializes a #graphene_quaternion_t with the values from #src.
		 * @param src a #graphene_quaternion_t
		 * @returns the initialized quaternion
		 */
		public init_from_quaternion(src: Quaternion): Quaternion;
		/**
		 * Initializes a #graphene_quaternion_t using the values of
		 * the [Euler angles](http://en.wikipedia.org/wiki/Euler_angles)
		 * on each axis.
		 * 
		 * See also: {@link Graphene.Quaternion.init_from_euler}
		 * @param rad_x rotation angle on the X axis (yaw), in radians
		 * @param rad_y rotation angle on the Y axis (pitch), in radians
		 * @param rad_z rotation angle on the Z axis (roll), in radians
		 * @returns the initialized quaternion
		 */
		public init_from_radians(rad_x: number, rad_y: number, rad_z: number): Quaternion;
		/**
		 * Initializes a #graphene_quaternion_t with the values from #src.
		 * @param src a #graphene_vec4_t
		 * @returns the initialized quaternion
		 */
		public init_from_vec4(src: Vec4): Quaternion;
		/**
		 * Initializes a #graphene_quaternion_t using the identity
		 * transformation.
		 * @returns the initialized quaternion
		 */
		public init_identity(): Quaternion;
		/**
		 * Inverts a #graphene_quaternion_t, and returns the conjugate
		 * quaternion of #q.
		 * @returns return location for the inverted
		 *   quaternion
		 */
		public invert(): Quaternion;
		/**
		 * Multiplies two #graphene_quaternion_t #a and #b.
		 * @param b a #graphene_quaternion_t
		 * @returns the result of the operation
		 */
		public multiply(b: Quaternion): Quaternion;
		/**
		 * Normalizes a #graphene_quaternion_t.
		 * @returns return location for the normalized
		 *   quaternion
		 */
		public normalize(): Quaternion;
		/**
		 * Scales all the elements of a #graphene_quaternion_t #q using
		 * the given scalar factor.
		 * @param factor a scaling factor
		 * @returns the result of the operation
		 */
		public scale(factor: number): Quaternion;
		/**
		 * Interpolates between the two given quaternions using a spherical
		 * linear interpolation, or [SLERP](http://en.wikipedia.org/wiki/Slerp),
		 * using the given interpolation #factor.
		 * @param b a #graphene_quaternion_t
		 * @param factor the linear interpolation factor
		 * @returns return location for the interpolated
		 *   quaternion
		 */
		public slerp(b: Quaternion, factor: number): Quaternion;
		/**
		 * Converts a quaternion into an #angle, #axis pair.
		 * @returns return location for the angle, in degrees
		 * 
		 * return location for the rotation axis
		 */
		public to_angle_vec3(): [ angle: number, axis: Vec3 ];
		/**
		 * Converts a #graphene_quaternion_t to its corresponding rotations
		 * on the [Euler angles](http://en.wikipedia.org/wiki/Euler_angles)
		 * on each axis.
		 * @returns return location for the rotation angle on
		 *   the X axis (yaw), in degrees
		 * 
		 * return location for the rotation angle on
		 *   the Y axis (pitch), in degrees
		 * 
		 * return location for the rotation angle on
		 *   the Z axis (roll), in degrees
		 */
		public to_angles(): [ deg_x: number | null, deg_y: number | null, deg_z: number | null ];
		/**
		 * Converts a quaternion into a transformation matrix expressing
		 * the rotation defined by the #graphene_quaternion_t.
		 * @returns a #graphene_matrix_t
		 */
		public to_matrix(): Matrix;
		/**
		 * Converts a #graphene_quaternion_t to its corresponding rotations
		 * on the [Euler angles](http://en.wikipedia.org/wiki/Euler_angles)
		 * on each axis.
		 * @returns return location for the rotation angle on
		 *   the X axis (yaw), in radians
		 * 
		 * return location for the rotation angle on
		 *   the Y axis (pitch), in radians
		 * 
		 * return location for the rotation angle on
		 *   the Z axis (roll), in radians
		 */
		public to_radians(): [ rad_x: number | null, rad_y: number | null, rad_z: number | null ];
		/**
		 * Copies the components of a #graphene_quaternion_t into a
		 * #graphene_vec4_t.
		 * @returns return location for a
		 *   #graphene_vec4_t
		 */
		public to_vec4(): Vec4;
	}

	export interface RayInitOptions {}
	/**
	 * A ray emitted from an origin in a given direction.
	 * 
	 * The contents of the `graphene_ray_t` structure are private, and should not
	 * be modified directly.
	 */
	interface Ray {}
	class Ray {
		public constructor(options?: Partial<RayInitOptions>);
		/**
		 * Allocates a new #graphene_ray_t structure.
		 * 
		 * The contents of the returned structure are undefined.
		 * @returns the newly allocated #graphene_ray_t.
		 *   Use {@link Graphene.Ray.free} to free the resources allocated by
		 *   this function
		 */
		public static alloc(): Ray;
		public readonly origin: Vec3;
		public readonly direction: Vec3;
		/**
		 * Checks whether the two given #graphene_ray_t are equal.
		 * @param b a #graphene_ray_t
		 * @returns `true` if the given rays are equal
		 */
		public equal(b: Ray): boolean;
		/**
		 * Frees the resources allocated by {@link Graphene.Ray.alloc}.
		 */
		public free(): void;
		/**
		 * Computes the point on the given #graphene_ray_t that is closest to the
		 * given point #p.
		 * @param p a #graphene_point3d_t
		 * @returns return location for the closest point3d
		 */
		public get_closest_point_to_point(p: Point3D): Point3D;
		/**
		 * Retrieves the direction of the given #graphene_ray_t.
		 * @returns return location for the direction
		 */
		public get_direction(): Vec3;
		/**
		 * Computes the distance of the origin of the given #graphene_ray_t from the
		 * given plane.
		 * 
		 * If the ray does not intersect the plane, this function returns `INFINITY`.
		 * @param p a #graphene_plane_t
		 * @returns the distance of the origin of the ray from the plane
		 */
		public get_distance_to_plane(p: Plane): number;
		/**
		 * Computes the distance of the closest approach between the
		 * given #graphene_ray_t #r and the point #p.
		 * 
		 * The closest approach to a ray from a point is the distance
		 * between the point and the projection of the point on the
		 * ray itself.
		 * @param p a #graphene_point3d_t
		 * @returns the distance of the point
		 */
		public get_distance_to_point(p: Point3D): number;
		/**
		 * Retrieves the origin of the given #graphene_ray_t.
		 * @returns return location for the origin
		 */
		public get_origin(): Point3D;
		/**
		 * Retrieves the coordinates of a point at the distance #t along the
		 * given #graphene_ray_t.
		 * @param t the distance along the ray
		 * @returns return location for the position
		 */
		public get_position_at(t: number): Point3D;
		/**
		 * Initializes the given #graphene_ray_t using the given #origin
		 * and #direction values.
		 * @param origin the origin of the ray
		 * @param direction the direction vector
		 * @returns the initialized ray
		 */
		public init(origin?: Point3D | null, direction?: Vec3 | null): Ray;
		/**
		 * Initializes the given #graphene_ray_t using the origin and direction
		 * values of another #graphene_ray_t.
		 * @param src a #graphene_ray_t
		 * @returns the initialized ray
		 */
		public init_from_ray(src: Ray): Ray;
		/**
		 * Initializes the given #graphene_ray_t using the given vectors.
		 * @param origin a #graphene_vec3_t
		 * @param direction a #graphene_vec3_t
		 * @returns the initialized ray
		 */
		public init_from_vec3(origin?: Vec3 | null, direction?: Vec3 | null): Ray;
		/**
		 * Intersects the given #graphene_ray_t #r with the given
		 * #graphene_box_t #b.
		 * @param b a #graphene_box_t
		 * @returns the type of intersection
		 * 
		 * the distance of the point on the ray that intersects the box
		 */
		public intersect_box(b: Box): [ RayIntersectionKind, number ];
		/**
		 * Intersects the given #graphene_ray_t #r with the given
		 * #graphene_sphere_t #s.
		 * @param s a #graphene_sphere_t
		 * @returns the type of intersection
		 * 
		 * the distance of the point on the ray that intersects the sphere
		 */
		public intersect_sphere(s: Sphere): [ RayIntersectionKind, number ];
		/**
		 * Intersects the given #graphene_ray_t #r with the given
		 * #graphene_triangle_t #t.
		 * @param t a #graphene_triangle_t
		 * @returns the type of intersection
		 * 
		 * the distance of the point on the ray that intersects the triangle
		 */
		public intersect_triangle(t: Triangle): [ RayIntersectionKind, number ];
		/**
		 * Checks whether the given #graphene_ray_t #r intersects the
		 * given #graphene_box_t #b.
		 * 
		 * See also: {@link Graphene.Ray.intersect_box}
		 * @param b a #graphene_box_t
		 * @returns `true` if the ray intersects the box
		 */
		public intersects_box(b: Box): boolean;
		/**
		 * Checks if the given #graphene_ray_t #r intersects the
		 * given #graphene_sphere_t #s.
		 * 
		 * See also: {@link Graphene.Ray.intersect_sphere}
		 * @param s a #graphene_sphere_t
		 * @returns `true` if the ray intersects the sphere
		 */
		public intersects_sphere(s: Sphere): boolean;
		/**
		 * Checks whether the given #graphene_ray_t #r intersects the
		 * given #graphene_triangle_t #b.
		 * 
		 * See also: {@link Graphene.Ray.intersect_triangle}
		 * @param t a #graphene_triangle_t
		 * @returns `true` if the ray intersects the triangle
		 */
		public intersects_triangle(t: Triangle): boolean;
	}

	export interface RectInitOptions {}
	/**
	 * The location and size of a rectangle region.
	 * 
	 * The width and height of a #graphene_rect_t can be negative; for instance,
	 * a #graphene_rect_t with an origin of [ 0, 0 ] and a size of [ 10, 10 ] is
	 * equivalent to a #graphene_rect_t with an origin of [ 10, 10 ] and a size
	 * of [ -10, -10 ].
	 * 
	 * Application code can normalize rectangles using {@link Graphene.Rect.normalize};
	 * this function will ensure that the width and height of a rectangle are
	 * positive values. All functions taking a #graphene_rect_t as an argument
	 * will internally operate on a normalized copy; all functions returning a
	 * #graphene_rect_t will always return a normalized rectangle.
	 */
	interface Rect {}
	class Rect {
		public constructor(options?: Partial<RectInitOptions>);
		/**
		 * Allocates a new #graphene_rect_t.
		 * 
		 * The contents of the returned rectangle are undefined.
		 * @returns the newly allocated rectangle
		 */
		public static alloc(): Rect;
		/**
		 * Returns a degenerate rectangle with origin fixed at (0, 0) and
		 * a size of 0, 0.
		 * @returns a fixed rectangle
		 */
		public static zero(): Rect;
		/**
		 * the coordinates of the origin of the rectangle
		 */
		public origin: Point;
		/**
		 * the size of the rectangle
		 */
		public size: Size;
		/**
		 * Checks whether a #graphene_rect_t contains the given coordinates.
		 * @param p a #graphene_point_t
		 * @returns `true` if the rectangle contains the point
		 */
		public contains_point(p: Point): boolean;
		/**
		 * Checks whether a #graphene_rect_t fully contains the given
		 * rectangle.
		 * @param b a #graphene_rect_t
		 * @returns `true` if the rectangle #a fully contains #b
		 */
		public contains_rect(b: Rect): boolean;
		/**
		 * Checks whether the two given rectangle are equal.
		 * @param b a #graphene_rect_t
		 * @returns `true` if the rectangles are equal
		 */
		public equal(b: Rect): boolean;
		/**
		 * Expands a #graphene_rect_t to contain the given #graphene_point_t.
		 * @param p a #graphene_point_t
		 * @returns return location for the expanded rectangle
		 */
		public expand(p: Point): Rect;
		/**
		 * Frees the resources allocated by {@link Graphene.rect.alloc}.
		 */
		public free(): void;
		/**
		 * Compute the area of given normalized rectangle.
		 * @returns the area of the normalized rectangle
		 */
		public get_area(): number;
		/**
		 * Retrieves the coordinates of the bottom-left corner of the given rectangle.
		 * @returns return location for a #graphene_point_t
		 */
		public get_bottom_left(): Point;
		/**
		 * Retrieves the coordinates of the bottom-right corner of the given rectangle.
		 * @returns return location for a #graphene_point_t
		 */
		public get_bottom_right(): Point;
		/**
		 * Retrieves the coordinates of the center of the given rectangle.
		 * @returns return location for a #graphene_point_t
		 */
		public get_center(): Point;
		/**
		 * Retrieves the normalized height of the given rectangle.
		 * @returns the normalized height of the rectangle
		 */
		public get_height(): number;
		/**
		 * Retrieves the coordinates of the top-left corner of the given rectangle.
		 * @returns return location for a #graphene_point_t
		 */
		public get_top_left(): Point;
		/**
		 * Retrieves the coordinates of the top-right corner of the given rectangle.
		 * @returns return location for a #graphene_point_t
		 */
		public get_top_right(): Point;
		/**
		 * Computes the four vertices of a #graphene_rect_t.
		 * @returns return location for an array
		 *  of 4 #graphene_vec2_t
		 */
		public get_vertices(): Vec2[];
		/**
		 * Retrieves the normalized width of the given rectangle.
		 * @returns the normalized width of the rectangle
		 */
		public get_width(): number;
		/**
		 * Retrieves the normalized X coordinate of the origin of the given
		 * rectangle.
		 * @returns the normalized X coordinate of the rectangle
		 */
		public get_x(): number;
		/**
		 * Retrieves the normalized Y coordinate of the origin of the given
		 * rectangle.
		 * @returns the normalized Y coordinate of the rectangle
		 */
		public get_y(): number;
		/**
		 * Initializes the given #graphene_rect_t with the given values.
		 * 
		 * This function will implicitly normalize the #graphene_rect_t
		 * before returning.
		 * @param x the X coordinate of the #graphene_rect_t.origin
		 * @param y the Y coordinate of the #graphene_rect_t.origin
		 * @param width the width of the #graphene_rect_t.size
		 * @param height the height of the #graphene_rect_t.size
		 * @returns the initialized rectangle
		 */
		public init(x: number, y: number, width: number, height: number): Rect;
		/**
		 * Initializes #r using the given #src rectangle.
		 * 
		 * This function will implicitly normalize the #graphene_rect_t
		 * before returning.
		 * @param src a #graphene_rect_t
		 * @returns the initialized rectangle
		 */
		public init_from_rect(src: Rect): Rect;
		/**
		 * Changes the given rectangle to be smaller, or larger depending on the
		 * given inset parameters.
		 * 
		 * To create an inset rectangle, use positive #d_x or #d_y values; to
		 * create a larger, encompassing rectangle, use negative #d_x or #d_y
		 * values.
		 * 
		 * The origin of the rectangle is offset by #d_x and #d_y, while the size
		 * is adjusted by `(2 * #d_x, 2 * #d_y)`. If #d_x and #d_y are positive
		 * values, the size of the rectangle is decreased; if #d_x and #d_y are
		 * negative values, the size of the rectangle is increased.
		 * 
		 * If the size of the resulting inset rectangle has a negative width or
		 * height then the size will be set to zero.
		 * @param d_x the horizontal inset
		 * @param d_y the vertical inset
		 * @returns the inset rectangle
		 */
		public inset(d_x: number, d_y: number): Rect;
		/**
		 * Changes the given rectangle to be smaller, or larger depending on the
		 * given inset parameters.
		 * 
		 * To create an inset rectangle, use positive #d_x or #d_y values; to
		 * create a larger, encompassing rectangle, use negative #d_x or #d_y
		 * values.
		 * 
		 * The origin of the rectangle is offset by #d_x and #d_y, while the size
		 * is adjusted by `(2 * #d_x, 2 * #d_y)`. If #d_x and #d_y are positive
		 * values, the size of the rectangle is decreased; if #d_x and #d_y are
		 * negative values, the size of the rectangle is increased.
		 * 
		 * If the size of the resulting inset rectangle has a negative width or
		 * height then the size will be set to zero.
		 * @param d_x the horizontal inset
		 * @param d_y the vertical inset
		 * @returns return location for the inset rectangle
		 */
		public inset_r(d_x: number, d_y: number): Rect;
		/**
		 * Linearly interpolates the origin and size of the two given
		 * rectangles.
		 * @param b a #graphene_rect_t
		 * @param factor the linear interpolation factor
		 * @returns return location for the
		 *   interpolated rectangle
		 */
		public interpolate(b: Rect, factor: number): Rect;
		/**
		 * Computes the intersection of the two given rectangles.
		 * 
		 * ![](rectangle-intersection.png)
		 * 
		 * The intersection in the image above is the blue outline.
		 * 
		 * If the two rectangles do not intersect, #res will contain
		 * a degenerate rectangle with origin in (0, 0) and a size of 0.
		 * @param b a #graphene_rect_t
		 * @returns `true` if the two rectangles intersect
		 * 
		 * return location for
		 *   a #graphene_rect_t
		 */
		public intersection(b: Rect): [ boolean, Rect | null ];
		/**
		 * Normalizes the passed rectangle.
		 * 
		 * This function ensures that the size of the rectangle is made of
		 * positive values, and that the origin is the top-left corner of
		 * the rectangle.
		 * @returns the normalized rectangle
		 */
		public normalize(): Rect;
		/**
		 * Normalizes the passed rectangle.
		 * 
		 * This function ensures that the size of the rectangle is made of
		 * positive values, and that the origin is in the top-left corner
		 * of the rectangle.
		 * @returns the return location for the
		 *   normalized rectangle
		 */
		public normalize_r(): Rect;
		/**
		 * Offsets the origin by #d_x and #d_y.
		 * 
		 * The size of the rectangle is unchanged.
		 * @param d_x the horizontal offset
		 * @param d_y the vertical offset
		 * @returns the offset rectangle
		 */
		public offset(d_x: number, d_y: number): Rect;
		/**
		 * Offsets the origin of the given rectangle by #d_x and #d_y.
		 * 
		 * The size of the rectangle is left unchanged.
		 * @param d_x the horizontal offset
		 * @param d_y the vertical offset
		 * @returns return location for the offset
		 *   rectangle
		 */
		public offset_r(d_x: number, d_y: number): Rect;
		/**
		 * @deprecated
		 * Use {@link Graphene.Rect.round_extents} instead
		 * 
		 * Rounds the origin and size of the given rectangle to
		 * their nearest integer values; the rounding is guaranteed
		 * to be large enough to have an area bigger or equal to the
		 * original rectangle, but might not fully contain its extents.
		 * Use {@link Graphene.Rect.round_extents} in case you need to round
		 * to a rectangle that covers fully the original one.
		 * 
		 * This function is the equivalent of calling `floor` on
		 * the coordinates of the origin, and `ceil` on the size.
		 * @returns return location for the
		 *   rounded rectangle
		 */
		public round(): Rect;
		/**
		 * Rounds the origin of the given rectangle to its nearest
		 * integer value and and recompute the size so that the
		 * rectangle is large enough to contain all the conrners
		 * of the original rectangle.
		 * 
		 * This function is the equivalent of calling `floor` on
		 * the coordinates of the origin, and recomputing the size
		 * calling `ceil` on the bottom-right coordinates.
		 * 
		 * If you want to be sure that the rounded rectangle
		 * completely covers the area that was covered by the
		 * original rectangle — i.e. you want to cover the area
		 * including all its corners — this function will make sure
		 * that the size is recomputed taking into account the ceiling
		 * of the coordinates of the bottom-right corner.
		 * If the difference between the original coordinates and the
		 * coordinates of the rounded rectangle is greater than the
		 * difference between the original size and and the rounded
		 * size, then the move of the origin would not be compensated
		 * by a move in the anti-origin, leaving the corners of the
		 * original rectangle outside the rounded one.
		 * @returns return location for the
		 *   rectangle with rounded extents
		 */
		public round_extents(): Rect;
		/**
		 * @deprecated
		 * Use {@link Graphene.Rect.round} instead
		 * 
		 * Rounds the origin and the size of the given rectangle to
		 * their nearest integer values; the rounding is guaranteed
		 * to be large enough to contain the original rectangle.
		 * @returns the pixel-aligned rectangle.
		 */
		public round_to_pixel(): Rect;
		/**
		 * Scales the size and origin of a rectangle horizontaly by #s_h,
		 * and vertically by #s_v. The result #res is normalized.
		 * @param s_h horizontal scale factor
		 * @param s_v vertical scale factor
		 * @returns return location for the
		 *   scaled rectangle
		 */
		public scale(s_h: number, s_v: number): Rect;
		/**
		 * Computes the union of the two given rectangles.
		 * 
		 * ![](rectangle-union.png)
		 * 
		 * The union in the image above is the blue outline.
		 * @param b a #graphene_rect_t
		 * @returns return location for a #graphene_rect_t
		 */
		public union(b: Rect): Rect;
	}

	export interface Simd4FInitOptions {}
	interface Simd4F {}
	class Simd4F {
		public constructor(options?: Partial<Simd4FInitOptions>);
		public readonly x: number;
		public readonly y: number;
		public readonly z: number;
		public readonly w: number;
	}

	export interface Simd4X4FInitOptions {}
	interface Simd4X4F {}
	class Simd4X4F {
		public constructor(options?: Partial<Simd4X4FInitOptions>);
		public readonly x: Simd4F;
		public readonly y: Simd4F;
		public readonly z: Simd4F;
		public readonly w: Simd4F;
	}

	export interface SizeInitOptions {}
	/**
	 * A size.
	 */
	interface Size {}
	class Size {
		public constructor(options?: Partial<SizeInitOptions>);
		/**
		 * Allocates a new #graphene_size_t.
		 * 
		 * The contents of the returned value are undefined.
		 * @returns the newly allocated #graphene_size_t
		 */
		public static alloc(): Size;
		/**
		 * A constant pointer to a zero #graphene_size_t, useful for
		 * equality checks and interpolations.
		 * @returns a constant size
		 */
		public static zero(): Size;
		/**
		 * the width
		 */
		public width: number;
		/**
		 * the height
		 */
		public height: number;
		/**
		 * Checks whether the two give #graphene_size_t are equal.
		 * @param b a #graphene_size_t
		 * @returns `true` if the sizes are equal
		 */
		public equal(b: Size): boolean;
		/**
		 * Frees the resources allocated by {@link Graphene.Size.alloc}.
		 */
		public free(): void;
		/**
		 * Initializes a #graphene_size_t using the given #width and #height.
		 * @param width the width
		 * @param height the height
		 * @returns the initialized #graphene_size_t
		 */
		public init(width: number, height: number): Size;
		/**
		 * Initializes a #graphene_size_t using the width and height of
		 * the given #src.
		 * @param src a #graphene_size_t
		 * @returns the initialized #graphene_size_t
		 */
		public init_from_size(src: Size): Size;
		/**
		 * Linearly interpolates the two given #graphene_size_t using the given
		 * interpolation #factor.
		 * @param b a #graphene_size_t
		 * @param factor the linear interpolation factor
		 * @returns return location for the interpolated size
		 */
		public interpolate(b: Size, factor: number): Size;
		/**
		 * Scales the components of a #graphene_size_t using the given #factor.
		 * @param factor the scaling factor
		 * @returns return location for the scaled size
		 */
		public scale(factor: number): Size;
	}

	export interface SphereInitOptions {}
	/**
	 * A sphere, represented by its center and radius.
	 */
	interface Sphere {}
	class Sphere {
		public constructor(options?: Partial<SphereInitOptions>);
		/**
		 * Allocates a new #graphene_sphere_t.
		 * 
		 * The contents of the newly allocated structure are undefined.
		 * @returns the newly allocated #graphene_sphere_t. Use
		 *   {@link Graphene.Sphere.free} to free the resources allocated by this function
		 */
		public static alloc(): Sphere;
		public readonly center: Vec3;
		public readonly radius: number;
		/**
		 * Checks whether the given #point is contained in the volume
		 * of a #graphene_sphere_t.
		 * @param point a #graphene_point3d_t
		 * @returns `true` if the sphere contains the point
		 */
		public contains_point(point: Point3D): boolean;
		/**
		 * Computes the distance of the given #point from the surface of
		 * a #graphene_sphere_t.
		 * @param point a #graphene_point3d_t
		 * @returns the distance of the point
		 */
		public distance(point: Point3D): number;
		/**
		 * Checks whether two #graphene_sphere_t are equal.
		 * @param b a #graphene_sphere_t
		 * @returns `true` if the spheres are equal
		 */
		public equal(b: Sphere): boolean;
		/**
		 * Frees the resources allocated by {@link Graphene.Sphere.alloc}.
		 */
		public free(): void;
		/**
		 * Computes the bounding box capable of containing the
		 * given #graphene_sphere_t.
		 * @returns return location for the bounding box
		 */
		public get_bounding_box(): Box;
		/**
		 * Retrieves the coordinates of the center of a #graphene_sphere_t.
		 * @returns return location for the coordinates of
		 *   the center
		 */
		public get_center(): Point3D;
		/**
		 * Retrieves the radius of a #graphene_sphere_t.
		 * @returns 
		 */
		public get_radius(): number;
		/**
		 * Initializes the given #graphene_sphere_t with the given #center and #radius.
		 * @param center the coordinates of the center of the sphere, or %NULL
		 *   for a center in (0, 0, 0)
		 * @param radius the radius of the sphere
		 * @returns the initialized #graphene_sphere_t
		 */
		public init(center: Point3D | null, radius: number): Sphere;
		/**
		 * Initializes the given #graphene_sphere_t using the given array
		 * of 3D coordinates so that the sphere includes them.
		 * 
		 * The center of the sphere can either be specified, or will be center
		 * of the 3D volume that encompasses all #points.
		 * @param points an array of #graphene_point3d_t
		 * @param center the center of the sphere
		 * @returns the initialized #graphene_sphere_t
		 */
		public init_from_points(points: Point3D[], center?: Point3D | null): Sphere;
		/**
		 * Initializes the given #graphene_sphere_t using the given array
		 * of 3D coordinates so that the sphere includes them.
		 * 
		 * The center of the sphere can either be specified, or will be center
		 * of the 3D volume that encompasses all #vectors.
		 * @param vectors an array of #graphene_vec3_t
		 * @param center the center of the sphere
		 * @returns the initialized #graphene_sphere_t
		 */
		public init_from_vectors(vectors: Vec3[], center?: Point3D | null): Sphere;
		/**
		 * Checks whether the sphere has a zero radius.
		 * @returns `true` if the sphere is empty
		 */
		public is_empty(): boolean;
		/**
		 * Translates the center of the given #graphene_sphere_t using the #point
		 * coordinates as the delta of the translation.
		 * @param point the coordinates of the translation
		 * @returns return location for the translated sphere
		 */
		public translate(point: Point3D): Sphere;
	}

	export interface TriangleInitOptions {}
	/**
	 * A triangle.
	 */
	interface Triangle {}
	class Triangle {
		public constructor(options?: Partial<TriangleInitOptions>);
		/**
		 * Allocates a new #graphene_triangle_t.
		 * 
		 * The contents of the returned structure are undefined.
		 * @returns the newly allocated #graphene_triangle_t
		 *   structure. Use {@link Graphene.Triangle.free} to free the resources
		 *   allocated by this function
		 */
		public static alloc(): Triangle;
		public readonly a: Vec3;
		public readonly b: Vec3;
		public readonly c: Vec3;
		/**
		 * Checks whether the given triangle #t contains the point #p.
		 * @param p a #graphene_point3d_t
		 * @returns `true` if the point is inside the triangle
		 */
		public contains_point(p: Point3D): boolean;
		/**
		 * Checks whether the two given #graphene_triangle_t are equal.
		 * @param b a #graphene_triangle_t
		 * @returns `true` if the triangles are equal
		 */
		public equal(b: Triangle): boolean;
		/**
		 * Frees the resources allocated by {@link Graphene.Triangle.alloc}.
		 */
		public free(): void;
		/**
		 * Computes the area of the given #graphene_triangle_t.
		 * @returns the area of the triangle
		 */
		public get_area(): number;
		/**
		 * Computes the [barycentric coordinates](http://en.wikipedia.org/wiki/Barycentric_coordinate_system)
		 * of the given point #p.
		 * 
		 * The point #p must lie on the same plane as the triangle #t; if the
		 * point is not coplanar, the result of this function is undefined.
		 * 
		 * If we place the origin in the coordinates of the triangle's A point,
		 * the barycentric coordinates are `u`, which is on the AC vector; and `v`
		 * which is on the AB vector:
		 * 
		 * ![](triangle-barycentric.png)
		 * 
		 * The returned #graphene_vec2_t contains the following values, in order:
		 * 
		 *  - `res.x = u`
		 *  - `res.y = v`
		 * @param p a #graphene_point3d_t
		 * @returns `true` if the barycentric coordinates are valid
		 * 
		 * return location for the vector
		 *   with the barycentric coordinates
		 */
		public get_barycoords(p?: Point3D | null): [ boolean, Vec2 ];
		/**
		 * Computes the bounding box of the given #graphene_triangle_t.
		 * @returns return location for the box
		 */
		public get_bounding_box(): Box;
		/**
		 * Computes the coordinates of the midpoint of the given #graphene_triangle_t.
		 * 
		 * The midpoint G is the [centroid](https://en.wikipedia.org/wiki/Centroid#Triangle_centroid)
		 * of the triangle, i.e. the intersection of its medians.
		 * @returns return location for the coordinates of
		 *   the midpoint
		 */
		public get_midpoint(): Point3D;
		/**
		 * Computes the normal vector of the given #graphene_triangle_t.
		 * @returns return location for the normal vector
		 */
		public get_normal(): Vec3;
		/**
		 * Computes the plane based on the vertices of the given #graphene_triangle_t.
		 * @returns return location for the plane
		 */
		public get_plane(): Plane;
		/**
		 * Retrieves the three vertices of the given #graphene_triangle_t and returns
		 * their coordinates as #graphene_point3d_t.
		 * @returns return location for the coordinates
		 *   of the first vertex
		 * 
		 * return location for the coordinates
		 *   of the second vertex
		 * 
		 * return location for the coordinates
		 *   of the third vertex
		 */
		public get_points(): [ a: Point3D | null, b: Point3D | null, c: Point3D | null ];
		/**
		 * Computes the UV coordinates of the given point #p.
		 * 
		 * The point #p must lie on the same plane as the triangle #t; if the point
		 * is not coplanar, the result of this function is undefined. If #p is %NULL,
		 * the point will be set in (0, 0, 0).
		 * 
		 * The UV coordinates will be placed in the #res vector:
		 * 
		 *  - `res.x = u`
		 *  - `res.y = v`
		 * 
		 * See also: {@link Graphene.Triangle.get_barycoords}
		 * @param p a #graphene_point3d_t
		 * @param uv_a the UV coordinates of the first point
		 * @param uv_b the UV coordinates of the second point
		 * @param uv_c the UV coordinates of the third point
		 * @returns `true` if the coordinates are valid
		 * 
		 * a vector containing the UV coordinates
		 *   of the given point #p
		 */
		public get_uv(p: Point3D | null, uv_a: Vec2, uv_b: Vec2, uv_c: Vec2): [ boolean, Vec2 ];
		/**
		 * Retrieves the three vertices of the given #graphene_triangle_t.
		 * @returns return location for the first vertex
		 * 
		 * return location for the second vertex
		 * 
		 * return location for the third vertex
		 */
		public get_vertices(): [ a: Vec3 | null, b: Vec3 | null, c: Vec3 | null ];
		/**
		 * Initializes a #graphene_triangle_t using the three given arrays
		 * of floating point values, each representing the coordinates of
		 * a point in 3D space.
		 * @param a an array of 3 floating point values
		 * @param b an array of 3 floating point values
		 * @param c an array of 3 floating point values
		 * @returns the initialized #graphene_triangle_t
		 */
		public init_from_float(a: number[], b: number[], c: number[]): Triangle;
		/**
		 * Initializes a #graphene_triangle_t using the three given 3D points.
		 * @param a a #graphene_point3d_t
		 * @param b a #graphene_point3d_t
		 * @param c a #graphene_point3d_t
		 * @returns the initialized #graphene_triangle_t
		 */
		public init_from_point3d(a?: Point3D | null, b?: Point3D | null, c?: Point3D | null): Triangle;
		/**
		 * Initializes a #graphene_triangle_t using the three given vectors.
		 * @param a a #graphene_vec3_t
		 * @param b a #graphene_vec3_t
		 * @param c a #graphene_vec3_t
		 * @returns the initialized #graphene_triangle_t
		 */
		public init_from_vec3(a?: Vec3 | null, b?: Vec3 | null, c?: Vec3 | null): Triangle;
	}

	export interface Vec2InitOptions {}
	/**
	 * A structure capable of holding a vector with two dimensions, x and y.
	 * 
	 * The contents of the #graphene_vec2_t structure are private and should
	 * never be accessed directly.
	 */
	interface Vec2 {}
	class Vec2 {
		public constructor(options?: Partial<Vec2InitOptions>);
		/**
		 * Allocates a new #graphene_vec2_t structure.
		 * 
		 * The contents of the returned structure are undefined.
		 * 
		 * Use {@link Graphene.Vec2.init} to initialize the vector.
		 * @returns the newly allocated #graphene_vec2_t
		 *   structure. Use {@link Graphene.Vec2.free} to free the resources allocated
		 *   by this function.
		 */
		public static alloc(): Vec2;
		/**
		 * Retrieves a constant vector with (1, 1) components.
		 * @returns the one vector
		 */
		public static one(): Vec2;
		/**
		 * Retrieves a constant vector with (1, 0) components.
		 * @returns the X axis vector
		 */
		public static x_axis(): Vec2;
		/**
		 * Retrieves a constant vector with (0, 1) components.
		 * @returns the Y axis vector
		 */
		public static y_axis(): Vec2;
		/**
		 * Retrieves a constant vector with (0, 0) components.
		 * @returns the zero vector
		 */
		public static zero(): Vec2;
		public readonly value: Simd4F;
		/**
		 * Adds each component of the two passed vectors and places
		 * each result into the components of #res.
		 * @param b a #graphene_vec2_t
		 * @returns return location for the result
		 */
		public add(b: Vec2): Vec2;
		/**
		 * Divides each component of the first operand #a by the corresponding
		 * component of the second operand #b, and places the results into the
		 * vector #res.
		 * @param b a #graphene_vec2_t
		 * @returns return location for the result
		 */
		public divide(b: Vec2): Vec2;
		/**
		 * Computes the dot product of the two given vectors.
		 * @param b a #graphene_vec2_t
		 * @returns the dot product of the vectors
		 */
		public dot(b: Vec2): number;
		/**
		 * Checks whether the two given #graphene_vec2_t are equal.
		 * @param v2 a #graphene_vec2_t
		 * @returns `true` if the two vectors are equal, and false otherwise
		 */
		public equal(v2: Vec2): boolean;
		/**
		 * Frees the resources allocated by #v
		 */
		public free(): void;
		/**
		 * Retrieves the X component of the #graphene_vec2_t.
		 * @returns the value of the X component
		 */
		public get_x(): number;
		/**
		 * Retrieves the Y component of the #graphene_vec2_t.
		 * @returns the value of the Y component
		 */
		public get_y(): number;
		/**
		 * Initializes a #graphene_vec2_t using the given values.
		 * 
		 * This function can be called multiple times.
		 * @param x the X field of the vector
		 * @param y the Y field of the vector
		 * @returns the initialized vector
		 */
		public init(x: number, y: number): Vec2;
		/**
		 * Initializes #v with the contents of the given array.
		 * @param src an array of floating point values
		 *   with at least two elements
		 * @returns the initialized vector
		 */
		public init_from_float(src: number[]): Vec2;
		/**
		 * Copies the contents of #src into #v.
		 * @param src a #graphene_vec2_t
		 * @returns the initialized vector
		 */
		public init_from_vec2(src: Vec2): Vec2;
		/**
		 * Linearly interpolates #v1 and #v2 using the given #factor.
		 * @param v2 a #graphene_vec2_t
		 * @param factor the interpolation factor
		 * @returns the interpolated vector
		 */
		public interpolate(v2: Vec2, factor: number): Vec2;
		/**
		 * Computes the length of the given vector.
		 * @returns the length of the vector
		 */
		public length(): number;
		/**
		 * Compares the two given vectors and places the maximum
		 * values of each component into #res.
		 * @param b a #graphene_vec2_t
		 * @returns the resulting vector
		 */
		public max(b: Vec2): Vec2;
		/**
		 * Compares the two given vectors and places the minimum
		 * values of each component into #res.
		 * @param b a #graphene_vec2_t
		 * @returns the resulting vector
		 */
		public min(b: Vec2): Vec2;
		/**
		 * Multiplies each component of the two passed vectors and places
		 * each result into the components of #res.
		 * @param b a #graphene_vec2_t
		 * @returns return location for the result
		 */
		public multiply(b: Vec2): Vec2;
		/**
		 * Compares the two given #graphene_vec2_t vectors and checks
		 * whether their values are within the given #epsilon.
		 * @param v2 a #graphene_vec2_t
		 * @param epsilon the threshold between the two vectors
		 * @returns `true` if the two vectors are near each other
		 */
		public near(v2: Vec2, epsilon: number): boolean;
		/**
		 * Negates the given #graphene_vec2_t.
		 * @returns return location for the result vector
		 */
		public negate(): Vec2;
		/**
		 * Computes the normalized vector for the given vector #v.
		 * @returns return location for the
		 *   normalized vector
		 */
		public normalize(): Vec2;
		/**
		 * Multiplies all components of the given vector with the given scalar #factor.
		 * @param factor the scalar factor
		 * @returns return location for the result vector
		 */
		public scale(factor: number): Vec2;
		/**
		 * Subtracts from each component of the first operand #a the
		 * corresponding component of the second operand #b and places
		 * each result into the components of #res.
		 * @param b a #graphene_vec2_t
		 * @returns return location for the result
		 */
		public subtract(b: Vec2): Vec2;
		/**
		 * Stores the components of #v into an array.
		 * @returns return location
		 *   for an array of floating point values with at least 2 elements
		 */
		public to_float(): number[];
	}

	export interface Vec3InitOptions {}
	/**
	 * A structure capable of holding a vector with three dimensions: x, y, and z.
	 * 
	 * The contents of the #graphene_vec3_t structure are private and should
	 * never be accessed directly.
	 */
	interface Vec3 {}
	class Vec3 {
		public constructor(options?: Partial<Vec3InitOptions>);
		/**
		 * Allocates a new #graphene_vec3_t structure.
		 * 
		 * The contents of the returned structure are undefined.
		 * 
		 * Use {@link Graphene.Vec3.init} to initialize the vector.
		 * @returns the newly allocated #graphene_vec3_t
		 *   structure. Use {@link Graphene.Vec3.free} to free the resources allocated
		 *   by this function.
		 */
		public static alloc(): Vec3;
		/**
		 * Provides a constant pointer to a vector with three components,
		 * all sets to 1.
		 * @returns a constant vector
		 */
		public static one(): Vec3;
		/**
		 * Provides a constant pointer to a vector with three components
		 * with values set to (1, 0, 0).
		 * @returns a constant vector
		 */
		public static x_axis(): Vec3;
		/**
		 * Provides a constant pointer to a vector with three components
		 * with values set to (0, 1, 0).
		 * @returns a constant vector
		 */
		public static y_axis(): Vec3;
		/**
		 * Provides a constant pointer to a vector with three components
		 * with values set to (0, 0, 1).
		 * @returns a constant vector
		 */
		public static z_axis(): Vec3;
		/**
		 * Provides a constant pointer to a vector with three components,
		 * all sets to 0.
		 * @returns a constant vector
		 */
		public static zero(): Vec3;
		public readonly value: Simd4F;
		/**
		 * Adds each component of the two given vectors.
		 * @param b a #graphene_vec3_t
		 * @returns return location for the resulting vector
		 */
		public add(b: Vec3): Vec3;
		/**
		 * Computes the cross product of the two given vectors.
		 * @param b a #graphene_vec3_t
		 * @returns return location for the resulting vector
		 */
		public cross(b: Vec3): Vec3;
		/**
		 * Divides each component of the first operand #a by the corresponding
		 * component of the second operand #b, and places the results into the
		 * vector #res.
		 * @param b a #graphene_vec3_t
		 * @returns return location for the resulting vector
		 */
		public divide(b: Vec3): Vec3;
		/**
		 * Computes the dot product of the two given vectors.
		 * @param b a #graphene_vec3_t
		 * @returns the value of the dot product
		 */
		public dot(b: Vec3): number;
		/**
		 * Checks whether the two given #graphene_vec3_t are equal.
		 * @param v2 a #graphene_vec3_t
		 * @returns `true` if the two vectors are equal, and false otherwise
		 */
		public equal(v2: Vec3): boolean;
		/**
		 * Frees the resources allocated by #v
		 */
		public free(): void;
		/**
		 * Retrieves the first component of the given vector #v.
		 * @returns the value of the first component of the vector
		 */
		public get_x(): number;
		/**
		 * Creates a #graphene_vec2_t that contains the first and second
		 * components of the given #graphene_vec3_t.
		 * @returns return location for a #graphene_vec2_t
		 */
		public get_xy(): Vec2;
		/**
		 * Creates a #graphene_vec3_t that contains the first two components of
		 * the given #graphene_vec3_t, and the third component set to 0.
		 * @returns return location for a #graphene_vec3_t
		 */
		public get_xy0(): Vec3;
		/**
		 * Converts a #graphene_vec3_t in a #graphene_vec4_t using 0.0
		 * as the value for the fourth component of the resulting vector.
		 * @returns return location for the vector
		 */
		public get_xyz0(): Vec4;
		/**
		 * Converts a #graphene_vec3_t in a #graphene_vec4_t using 1.0
		 * as the value for the fourth component of the resulting vector.
		 * @returns return location for the vector
		 */
		public get_xyz1(): Vec4;
		/**
		 * Converts a #graphene_vec3_t in a #graphene_vec4_t using #w as
		 * the value of the fourth component of the resulting vector.
		 * @param w the value of the W component
		 * @returns return location for the vector
		 */
		public get_xyzw(w: number): Vec4;
		/**
		 * Retrieves the second component of the given vector #v.
		 * @returns the value of the second component of the vector
		 */
		public get_y(): number;
		/**
		 * Retrieves the third component of the given vector #v.
		 * @returns the value of the third component of the vector
		 */
		public get_z(): number;
		/**
		 * Initializes a #graphene_vec3_t using the given values.
		 * 
		 * This function can be called multiple times.
		 * @param x the X field of the vector
		 * @param y the Y field of the vector
		 * @param z the Z field of the vector
		 * @returns a pointer to the initialized
		 *   vector
		 */
		public init(x: number, y: number, z: number): Vec3;
		/**
		 * Initializes a #graphene_vec3_t with the values from an array.
		 * @param src an array of 3 floating point values
		 * @returns the initialized vector
		 */
		public init_from_float(src: number[]): Vec3;
		/**
		 * Initializes a #graphene_vec3_t with the values of another
		 * #graphene_vec3_t.
		 * @param src a #graphene_vec3_t
		 * @returns the initialized vector
		 */
		public init_from_vec3(src: Vec3): Vec3;
		/**
		 * Linearly interpolates #v1 and #v2 using the given #factor.
		 * @param v2 a #graphene_vec3_t
		 * @param factor the interpolation factor
		 * @returns the interpolated vector
		 */
		public interpolate(v2: Vec3, factor: number): Vec3;
		/**
		 * Retrieves the length of the given vector #v.
		 * @returns the value of the length of the vector
		 */
		public length(): number;
		/**
		 * Compares each component of the two given vectors and creates a
		 * vector that contains the maximum values.
		 * @param b a #graphene_vec3_t
		 * @returns return location for the result vector
		 */
		public max(b: Vec3): Vec3;
		/**
		 * Compares each component of the two given vectors and creates a
		 * vector that contains the minimum values.
		 * @param b a #graphene_vec3_t
		 * @returns return location for the result vector
		 */
		public min(b: Vec3): Vec3;
		/**
		 * Multiplies each component of the two given vectors.
		 * @param b a #graphene_vec3_t
		 * @returns return location for the resulting vector
		 */
		public multiply(b: Vec3): Vec3;
		/**
		 * Compares the two given #graphene_vec3_t vectors and checks
		 * whether their values are within the given #epsilon.
		 * @param v2 a #graphene_vec3_t
		 * @param epsilon the threshold between the two vectors
		 * @returns `true` if the two vectors are near each other
		 */
		public near(v2: Vec3, epsilon: number): boolean;
		/**
		 * Negates the given #graphene_vec3_t.
		 * @returns return location for the result vector
		 */
		public negate(): Vec3;
		/**
		 * Normalizes the given #graphene_vec3_t.
		 * @returns return location for the normalized vector
		 */
		public normalize(): Vec3;
		/**
		 * Multiplies all components of the given vector with the given scalar #factor.
		 * @param factor the scalar factor
		 * @returns return location for the result vector
		 */
		public scale(factor: number): Vec3;
		/**
		 * Subtracts from each component of the first operand #a the
		 * corresponding component of the second operand #b and places
		 * each result into the components of #res.
		 * @param b a #graphene_vec3_t
		 * @returns return location for the resulting vector
		 */
		public subtract(b: Vec3): Vec3;
		/**
		 * Copies the components of a #graphene_vec3_t into the given array.
		 * @returns return location for
		 *   an array of floating point values
		 */
		public to_float(): number[];
	}

	export interface Vec4InitOptions {}
	/**
	 * A structure capable of holding a vector with four dimensions: x, y, z, and w.
	 * 
	 * The contents of the #graphene_vec4_t structure are private and should
	 * never be accessed directly.
	 */
	interface Vec4 {}
	class Vec4 {
		public constructor(options?: Partial<Vec4InitOptions>);
		/**
		 * Allocates a new #graphene_vec4_t structure.
		 * 
		 * The contents of the returned structure are undefined.
		 * 
		 * Use {@link Graphene.Vec4.init} to initialize the vector.
		 * @returns the newly allocated #graphene_vec4_t
		 *   structure. Use {@link Graphene.Vec4.free} to free the resources allocated
		 *   by this function.
		 */
		public static alloc(): Vec4;
		/**
		 * Retrieves a pointer to a #graphene_vec4_t with all its
		 * components set to 1.
		 * @returns a constant vector
		 */
		public static one(): Vec4;
		/**
		 * Retrieves a pointer to a #graphene_vec4_t with its
		 * components set to (0, 0, 0, 1).
		 * @returns a constant vector
		 */
		public static w_axis(): Vec4;
		/**
		 * Retrieves a pointer to a #graphene_vec4_t with its
		 * components set to (1, 0, 0, 0).
		 * @returns a constant vector
		 */
		public static x_axis(): Vec4;
		/**
		 * Retrieves a pointer to a #graphene_vec4_t with its
		 * components set to (0, 1, 0, 0).
		 * @returns a constant vector
		 */
		public static y_axis(): Vec4;
		/**
		 * Retrieves a pointer to a #graphene_vec4_t with its
		 * components set to (0, 0, 1, 0).
		 * @returns a constant vector
		 */
		public static z_axis(): Vec4;
		/**
		 * Retrieves a pointer to a #graphene_vec4_t with all its
		 * components set to 0.
		 * @returns a constant vector
		 */
		public static zero(): Vec4;
		public readonly value: Simd4F;
		/**
		 * Adds each component of the two given vectors.
		 * @param b a #graphene_vec4_t
		 * @returns return location for the resulting vector
		 */
		public add(b: Vec4): Vec4;
		/**
		 * Divides each component of the first operand #a by the corresponding
		 * component of the second operand #b, and places the results into the
		 * vector #res.
		 * @param b a #graphene_vec4_t
		 * @returns return location for the resulting vector
		 */
		public divide(b: Vec4): Vec4;
		/**
		 * Computes the dot product of the two given vectors.
		 * @param b a #graphene_vec4_t
		 * @returns the value of the dot product
		 */
		public dot(b: Vec4): number;
		/**
		 * Checks whether the two given #graphene_vec4_t are equal.
		 * @param v2 a #graphene_vec4_t
		 * @returns `true` if the two vectors are equal, and false otherwise
		 */
		public equal(v2: Vec4): boolean;
		/**
		 * Frees the resources allocated by #v
		 */
		public free(): void;
		/**
		 * Retrieves the value of the fourth component of the given #graphene_vec4_t.
		 * @returns the value of the fourth component
		 */
		public get_w(): number;
		/**
		 * Retrieves the value of the first component of the given #graphene_vec4_t.
		 * @returns the value of the first component
		 */
		public get_x(): number;
		/**
		 * Creates a #graphene_vec2_t that contains the first two components
		 * of the given #graphene_vec4_t.
		 * @returns return location for a #graphene_vec2_t
		 */
		public get_xy(): Vec2;
		/**
		 * Creates a #graphene_vec3_t that contains the first three components
		 * of the given #graphene_vec4_t.
		 * @returns return location for a graphene_vec3_t
		 */
		public get_xyz(): Vec3;
		/**
		 * Retrieves the value of the second component of the given #graphene_vec4_t.
		 * @returns the value of the second component
		 */
		public get_y(): number;
		/**
		 * Retrieves the value of the third component of the given #graphene_vec4_t.
		 * @returns the value of the third component
		 */
		public get_z(): number;
		/**
		 * Initializes a #graphene_vec4_t using the given values.
		 * 
		 * This function can be called multiple times.
		 * @param x the X field of the vector
		 * @param y the Y field of the vector
		 * @param z the Z field of the vector
		 * @param w the W field of the vector
		 * @returns a pointer to the initialized
		 *   vector
		 */
		public init(x: number, y: number, z: number, w: number): Vec4;
		/**
		 * Initializes a #graphene_vec4_t with the values inside the given array.
		 * @param src an array of four floating point values
		 * @returns the initialized vector
		 */
		public init_from_float(src: number[]): Vec4;
		/**
		 * Initializes a #graphene_vec4_t using the components of a
		 * #graphene_vec2_t and the values of #z and #w.
		 * @param src a #graphene_vec2_t
		 * @param z the value for the third component of #v
		 * @param w the value for the fourth component of #v
		 * @returns the initialized vector
		 */
		public init_from_vec2(src: Vec2, z: number, w: number): Vec4;
		/**
		 * Initializes a #graphene_vec4_t using the components of a
		 * #graphene_vec3_t and the value of #w.
		 * @param src a #graphene_vec3_t
		 * @param w the value for the fourth component of #v
		 * @returns the initialized vector
		 */
		public init_from_vec3(src: Vec3, w: number): Vec4;
		/**
		 * Initializes a #graphene_vec4_t using the components of
		 * another #graphene_vec4_t.
		 * @param src a #graphene_vec4_t
		 * @returns the initialized vector
		 */
		public init_from_vec4(src: Vec4): Vec4;
		/**
		 * Linearly interpolates #v1 and #v2 using the given #factor.
		 * @param v2 a #graphene_vec4_t
		 * @param factor the interpolation factor
		 * @returns the interpolated vector
		 */
		public interpolate(v2: Vec4, factor: number): Vec4;
		/**
		 * Computes the length of the given #graphene_vec4_t.
		 * @returns the length of the vector
		 */
		public length(): number;
		/**
		 * Compares each component of the two given vectors and creates a
		 * vector that contains the maximum values.
		 * @param b a #graphene_vec4_t
		 * @returns return location for the result vector
		 */
		public max(b: Vec4): Vec4;
		/**
		 * Compares each component of the two given vectors and creates a
		 * vector that contains the minimum values.
		 * @param b a #graphene_vec4_t
		 * @returns return location for the result vector
		 */
		public min(b: Vec4): Vec4;
		/**
		 * Multiplies each component of the two given vectors.
		 * @param b a #graphene_vec4_t
		 * @returns return location for the resulting vector
		 */
		public multiply(b: Vec4): Vec4;
		/**
		 * Compares the two given #graphene_vec4_t vectors and checks
		 * whether their values are within the given #epsilon.
		 * @param v2 a #graphene_vec4_t
		 * @param epsilon the threshold between the two vectors
		 * @returns `true` if the two vectors are near each other
		 */
		public near(v2: Vec4, epsilon: number): boolean;
		/**
		 * Negates the given #graphene_vec4_t.
		 * @returns return location for the result vector
		 */
		public negate(): Vec4;
		/**
		 * Normalizes the given #graphene_vec4_t.
		 * @returns return location for the normalized
		 *   vector
		 */
		public normalize(): Vec4;
		/**
		 * Multiplies all components of the given vector with the given scalar #factor.
		 * @param factor the scalar factor
		 * @returns return location for the result vector
		 */
		public scale(factor: number): Vec4;
		/**
		 * Subtracts from each component of the first operand #a the
		 * corresponding component of the second operand #b and places
		 * each result into the components of #res.
		 * @param b a #graphene_vec4_t
		 * @returns return location for the resulting vector
		 */
		public subtract(b: Vec4): Vec4;
		/**
		 * Stores the components of the given #graphene_vec4_t into an array
		 * of floating point values.
		 * @returns return location for
		 *   an array of floating point values
		 */
		public to_float(): number[];
	}

	/**
	 * Specify the order of the rotations on each axis.
	 * 
	 * The %GRAPHENE_EULER_ORDER_DEFAULT value is special, and is used
	 * as an alias for one of the other orders.
	 */
	enum EulerOrder {
		/**
		 * Rotate in the default order; the
		 *   default order is one of the following enumeration values
		 */
		DEFAULT = -1,
		/**
		 * Rotate in the X, Y, and Z order. Deprecated in
		 *   Graphene 1.10, it's an alias for %GRAPHENE_EULER_ORDER_SXYZ
		 */
		XYZ = 0,
		/**
		 * Rotate in the Y, Z, and X order. Deprecated in
		 *   Graphene 1.10, it's an alias for %GRAPHENE_EULER_ORDER_SYZX
		 */
		YZX = 1,
		/**
		 * Rotate in the Z, X, and Y order. Deprecated in
		 *   Graphene 1.10, it's an alias for %GRAPHENE_EULER_ORDER_SZXY
		 */
		ZXY = 2,
		/**
		 * Rotate in the X, Z, and Y order. Deprecated in
		 *   Graphene 1.10, it's an alias for %GRAPHENE_EULER_ORDER_SXZY
		 */
		XZY = 3,
		/**
		 * Rotate in the Y, X, and Z order. Deprecated in
		 *   Graphene 1.10, it's an alias for %GRAPHENE_EULER_ORDER_SYXZ
		 */
		YXZ = 4,
		/**
		 * Rotate in the Z, Y, and X order. Deprecated in
		 *   Graphene 1.10, it's an alias for %GRAPHENE_EULER_ORDER_SZYX
		 */
		ZYX = 5,
		/**
		 * Defines a static rotation along the X, Y, and Z axes (Since: 1.10)
		 */
		SXYZ = 6,
		/**
		 * Defines a static rotation along the X, Y, and X axes (Since: 1.10)
		 */
		SXYX = 7,
		/**
		 * Defines a static rotation along the X, Z, and Y axes (Since: 1.10)
		 */
		SXZY = 8,
		/**
		 * Defines a static rotation along the X, Z, and X axes (Since: 1.10)
		 */
		SXZX = 9,
		/**
		 * Defines a static rotation along the Y, Z, and X axes (Since: 1.10)
		 */
		SYZX = 10,
		/**
		 * Defines a static rotation along the Y, Z, and Y axes (Since: 1.10)
		 */
		SYZY = 11,
		/**
		 * Defines a static rotation along the Y, X, and Z axes (Since: 1.10)
		 */
		SYXZ = 12,
		/**
		 * Defines a static rotation along the Y, X, and Y axes (Since: 1.10)
		 */
		SYXY = 13,
		/**
		 * Defines a static rotation along the Z, X, and Y axes (Since: 1.10)
		 */
		SZXY = 14,
		/**
		 * Defines a static rotation along the Z, X, and Z axes (Since: 1.10)
		 */
		SZXZ = 15,
		/**
		 * Defines a static rotation along the Z, Y, and X axes (Since: 1.10)
		 */
		SZYX = 16,
		/**
		 * Defines a static rotation along the Z, Y, and Z axes (Since: 1.10)
		 */
		SZYZ = 17,
		/**
		 * Defines a relative rotation along the Z, Y, and X axes (Since: 1.10)
		 */
		RZYX = 18,
		/**
		 * Defines a relative rotation along the X, Y, and X axes (Since: 1.10)
		 */
		RXYX = 19,
		/**
		 * Defines a relative rotation along the Y, Z, and X axes (Since: 1.10)
		 */
		RYZX = 20,
		/**
		 * Defines a relative rotation along the X, Z, and X axes (Since: 1.10)
		 */
		RXZX = 21,
		/**
		 * Defines a relative rotation along the X, Z, and Y axes (Since: 1.10)
		 */
		RXZY = 22,
		/**
		 * Defines a relative rotation along the Y, Z, and Y axes (Since: 1.10)
		 */
		RYZY = 23,
		/**
		 * Defines a relative rotation along the Z, X, and Y axes (Since: 1.10)
		 */
		RZXY = 24,
		/**
		 * Defines a relative rotation along the Y, X, and Y axes (Since: 1.10)
		 */
		RYXY = 25,
		/**
		 * Defines a relative rotation along the Y, X, and Z axes (Since: 1.10)
		 */
		RYXZ = 26,
		/**
		 * Defines a relative rotation along the Z, X, and Z axes (Since: 1.10)
		 */
		RZXZ = 27,
		/**
		 * Defines a relative rotation along the X, Y, and Z axes (Since: 1.10)
		 */
		RXYZ = 28,
		/**
		 * Defines a relative rotation along the Z, Y, and Z axes (Since: 1.10)
		 */
		RZYZ = 29
	}

	/**
	 * The type of intersection.
	 */
	enum RayIntersectionKind {
		/**
		 * No intersection
		 */
		NONE = 0,
		/**
		 * The ray is entering the intersected
		 *   object
		 */
		ENTER = 1,
		/**
		 * The ray is leaving the intersected
		 *   object
		 */
		LEAVE = 2
	}

	/**
	 * A degenerate #graphene_box_t that can only be expanded.
	 * 
	 * The returned value is owned by Graphene and should not be modified or freed.
	 * @returns a #graphene_box_t
	 */
	function box_empty(): Box;
	/**
	 * A degenerate #graphene_box_t that cannot be expanded.
	 * 
	 * The returned value is owned by Graphene and should not be modified or freed.
	 * @returns a #graphene_box_t
	 */
	function box_infinite(): Box;
	/**
	 * A #graphene_box_t with the minimum vertex set at (-1, -1, -1) and the
	 * maximum vertex set at (0, 0, 0).
	 * 
	 * The returned value is owned by Graphene and should not be modified or freed.
	 * @returns a #graphene_box_t
	 */
	function box_minus_one(): Box;
	/**
	 * A #graphene_box_t with the minimum vertex set at (0, 0, 0) and the
	 * maximum vertex set at (1, 1, 1).
	 * 
	 * The returned value is owned by Graphene and should not be modified or freed.
	 * @returns a #graphene_box_t
	 */
	function box_one(): Box;
	/**
	 * A #graphene_box_t with the minimum vertex set at (-1, -1, -1) and the
	 * maximum vertex set at (1, 1, 1).
	 * 
	 * The returned value is owned by Graphene and should not be modified or freed.
	 * @returns a #graphene_box_t
	 */
	function box_one_minus_one(): Box;
	/**
	 * A #graphene_box_t with both the minimum and maximum vertices set at (0, 0, 0).
	 * 
	 * The returned value is owned by Graphene and should not be modified or freed.
	 * @returns a #graphene_box_t
	 */
	function box_zero(): Box;
	/**
	 * Retrieves a constant point with all three coordinates set to 0.
	 * @returns a zero point
	 */
	function point3d_zero(): Point3D;
	/**
	 * Returns a point fixed at (0, 0).
	 * @returns a fixed point
	 */
	function point_zero(): Point;
	/**
	 * Allocates a new #graphene_rect_t.
	 * 
	 * The contents of the returned rectangle are undefined.
	 * @returns the newly allocated rectangle
	 */
	function rect_alloc(): Rect;
	/**
	 * Returns a degenerate rectangle with origin fixed at (0, 0) and
	 * a size of 0, 0.
	 * @returns a fixed rectangle
	 */
	function rect_zero(): Rect;
	/**
	 * A constant pointer to a zero #graphene_size_t, useful for
	 * equality checks and interpolations.
	 * @returns a constant size
	 */
	function size_zero(): Size;
	/**
	 * Retrieves a constant vector with (1, 1) components.
	 * @returns the one vector
	 */
	function vec2_one(): Vec2;
	/**
	 * Retrieves a constant vector with (1, 0) components.
	 * @returns the X axis vector
	 */
	function vec2_x_axis(): Vec2;
	/**
	 * Retrieves a constant vector with (0, 1) components.
	 * @returns the Y axis vector
	 */
	function vec2_y_axis(): Vec2;
	/**
	 * Retrieves a constant vector with (0, 0) components.
	 * @returns the zero vector
	 */
	function vec2_zero(): Vec2;
	/**
	 * Provides a constant pointer to a vector with three components,
	 * all sets to 1.
	 * @returns a constant vector
	 */
	function vec3_one(): Vec3;
	/**
	 * Provides a constant pointer to a vector with three components
	 * with values set to (1, 0, 0).
	 * @returns a constant vector
	 */
	function vec3_x_axis(): Vec3;
	/**
	 * Provides a constant pointer to a vector with three components
	 * with values set to (0, 1, 0).
	 * @returns a constant vector
	 */
	function vec3_y_axis(): Vec3;
	/**
	 * Provides a constant pointer to a vector with three components
	 * with values set to (0, 0, 1).
	 * @returns a constant vector
	 */
	function vec3_z_axis(): Vec3;
	/**
	 * Provides a constant pointer to a vector with three components,
	 * all sets to 0.
	 * @returns a constant vector
	 */
	function vec3_zero(): Vec3;
	/**
	 * Retrieves a pointer to a #graphene_vec4_t with all its
	 * components set to 1.
	 * @returns a constant vector
	 */
	function vec4_one(): Vec4;
	/**
	 * Retrieves a pointer to a #graphene_vec4_t with its
	 * components set to (0, 0, 0, 1).
	 * @returns a constant vector
	 */
	function vec4_w_axis(): Vec4;
	/**
	 * Retrieves a pointer to a #graphene_vec4_t with its
	 * components set to (1, 0, 0, 0).
	 * @returns a constant vector
	 */
	function vec4_x_axis(): Vec4;
	/**
	 * Retrieves a pointer to a #graphene_vec4_t with its
	 * components set to (0, 1, 0, 0).
	 * @returns a constant vector
	 */
	function vec4_y_axis(): Vec4;
	/**
	 * Retrieves a pointer to a #graphene_vec4_t with its
	 * components set to (0, 0, 1, 0).
	 * @returns a constant vector
	 */
	function vec4_z_axis(): Vec4;
	/**
	 * Retrieves a pointer to a #graphene_vec4_t with all its
	 * components set to 0.
	 * @returns a constant vector
	 */
	function vec4_zero(): Vec4;
	const PI: number;

	const PI_2: number;

	/**
	 * Evaluates to the number of components of a #graphene_vec2_t.
	 * 
	 * This symbol is useful when declaring a C array of floating
	 * point values to be used with {@link Graphene.Vec2.init_from_float} and
	 * graphene_vec2_to_float(), e.g.
	 * 
	 * |[
	 *   float v[GRAPHENE_VEC2_LEN];
	 * 
	 *   // vec is defined elsewhere
	 *   graphene_vec2_to_float (&vec, v);
	 * 
	 *   for (int i = 0; i < GRAPHENE_VEC2_LEN; i++)
	 *     fprintf (stdout, "component %d: %g\n", i, v[i]);
	 * ]|
	 * @returns Evaluates to the number of components of a #graphene_vec2_t.
	 * 
	 * This symbol is useful when declaring a C array of floating
	 * point values to be used with {@link Graphene.Vec2.init_from_float} and
	 * graphene_vec2_to_float(), e.g.
	 * 
	 * |[
	 *   float v[GRAPHENE_VEC2_LEN];
	 * 
	 *   // vec is defined elsewhere
	 *   graphene_vec2_to_float (&vec, v);
	 * 
	 *   for (int i = 0; i < GRAPHENE_VEC2_LEN; i++)
	 *     fprintf (stdout, "component %d: %g\n", i, v[i]);
	 * ]|
	 */
	const VEC2_LEN: number;

	/**
	 * Evaluates to the number of components of a #graphene_vec3_t.
	 * 
	 * This symbol is useful when declaring a C array of floating
	 * point values to be used with {@link Graphene.Vec3.init_from_float} and
	 * graphene_vec3_to_float(), e.g.
	 * 
	 * |[
	 *   float v[GRAPHENE_VEC3_LEN];
	 * 
	 *   // vec is defined elsewhere
	 *   graphene_vec3_to_float (&vec, v);
	 * 
	 *   for (int i = 0; i < GRAPHENE_VEC2_LEN; i++)
	 *     fprintf (stdout, "component %d: %g\n", i, v[i]);
	 * ]|
	 * @returns Evaluates to the number of components of a #graphene_vec3_t.
	 * 
	 * This symbol is useful when declaring a C array of floating
	 * point values to be used with {@link Graphene.Vec3.init_from_float} and
	 * graphene_vec3_to_float(), e.g.
	 * 
	 * |[
	 *   float v[GRAPHENE_VEC3_LEN];
	 * 
	 *   // vec is defined elsewhere
	 *   graphene_vec3_to_float (&vec, v);
	 * 
	 *   for (int i = 0; i < GRAPHENE_VEC2_LEN; i++)
	 *     fprintf (stdout, "component %d: %g\n", i, v[i]);
	 * ]|
	 */
	const VEC3_LEN: number;

	/**
	 * Evaluates to the number of components of a #graphene_vec4_t.
	 * 
	 * This symbol is useful when declaring a C array of floating
	 * point values to be used with {@link Graphene.Vec4.init_from_float} and
	 * graphene_vec4_to_float(), e.g.
	 * 
	 * |[
	 *   float v[GRAPHENE_VEC4_LEN];
	 * 
	 *   // vec is defined elsewhere
	 *   graphene_vec4_to_float (&vec, v);
	 * 
	 *   for (int i = 0; i < GRAPHENE_VEC4_LEN; i++)
	 *     fprintf (stdout, "component %d: %g\n", i, v[i]);
	 * ]|
	 * @returns Evaluates to the number of components of a #graphene_vec4_t.
	 * 
	 * This symbol is useful when declaring a C array of floating
	 * point values to be used with {@link Graphene.Vec4.init_from_float} and
	 * graphene_vec4_to_float(), e.g.
	 * 
	 * |[
	 *   float v[GRAPHENE_VEC4_LEN];
	 * 
	 *   // vec is defined elsewhere
	 *   graphene_vec4_to_float (&vec, v);
	 * 
	 *   for (int i = 0; i < GRAPHENE_VEC4_LEN; i++)
	 *     fprintf (stdout, "component %d: %g\n", i, v[i]);
	 * ]|
	 */
	const VEC4_LEN: number;

}